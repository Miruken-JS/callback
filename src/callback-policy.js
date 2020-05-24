import { 
    Base, Undefined, Variance, decorate,
    isDescriptor, design, designWithReturn,
    $isNothing, $isFunction, $classOf,
    $lift, $contents, createKey
} from "miruken-core";

import HandlerDescriptor from "./handler-descriptor";

const _ = createKey();

/**
 * Sentinel indicating callback not handled.
 */                
export function $unhandled(result) {
    return result === $unhandled;
}

export const CallbackPolicy = Base.extend({
    /**
    * Constructs a callback policy.
    * @method create
    * @param   {Variance}  variance -  policy variance
    * @param   {String}    name     -  policy name 
    */    
    constructor(variance, name) {
        if (this.constructor === CallbackPolicy) {
            throw new Error("CallbackPolicy cannot be instantiated.  Use CovariantPolicy, ContravariantPolicy, or InvariantPolicy.");
        }
        _(this).variance = variance;
        _(this).name     = name;
    },

    get variance() { return _(this).variance; },
    get name() { return _(this).name; },

    /**
     * Registers the handler for the specified constraint.
     * @method acceptResult
     * @param   {Any}       owner       -  instance of class handler.
     * @param   {Any}       constraint  -  the constraint to handle.
     * @param   {Function}  handler     -  the handling function.
     * @param   {Function}  [removed]   -  optional function called on removal.
     * @return  {Function}  returns true if the result satisfies the variance.
     */
    addHandler(owner, constraint, handler, removed) {
        if ($isNothing(owner)) {
            throw new Error("The owner argument is required");
        } else if ($isNothing(handler)) {
            handler    = constraint;
            constraint = $classOf($contents(constraint));
        }
        if ($isNothing(handler)) {
            throw new Error("The handler argument is required");
        }
        if (Array.isArray(constraint)) {
            if (constraint.length == 1) {
                constraint = constraint[0];
            } else {
                return constraint.reduce((result, c) => {
                    const undefine = addHandler.call(this, owner, c, handler, removed);
                    return notifyRemoved => {
                        result(notifyRemoved);
                        undefine(notifyRemoved);
                    };
                }, Undefined);
            }
        }
        return addHandler.call(this, owner, constraint, handler, removed);
    },

    dispatch(handler, callback, constraint, composer, greedy, results) {
        const descriptor = HandlerDescriptor.get(handler, true);
        return descriptor != null && descriptor.dispatch(
            this, handler, callback, constraint, composer, greedy, results);
    },

    /**
     * Defines if the callbacl result is valid for the variance.
     * @method acceptResult
     * @param   {Any}    result  -  the callback result
     * @return  {Function}  returns true if the result satisfies the variance.
     */
    acceptResult(result) {
        throw new Error("CallbackPolicy.acceptResult not implemented.");
    },

    /**
     * Defines if the callbacl result is valid for the variance.
     * @method acceptResult
     * @param   {Binding}    binding       -  the first binding
     * @param   {Binding}    otherBinding  -  the other binding to compare with.
     * @return  {Function}  0, -1, 1 according to standard comparisons.
     */
    compareBinding(binding, otherBinding) {
        throw new Error("CallbackPolicy.compareBinding not implemented.");
    }
}, {
    /**
     * Creates a decorator for the implied policy.
     * @method createDecorator
     * @param  {Object}    [allowGets]  -  true to allow property handlers
     * @param  {Function}  [filter]     -  optional callback filter
     */
    createDecorator(name, allowGets, filter) {
        const policy = new this(name);
        function decorator(...args) {
            return decorate(registerHandlers(name, policy, allowGets, filter), args);
        }
        decorator.policy     = policy;
        decorator.addHandler = function (...args) {
            return policy.addHandler.apply(policy, args);
        };
        decorator.dispatch = function (...args) {
            return policy.dispatch.apply(policy, args);
        }; 
        return decorator;
    },
    dispatch(handler, callback, greedy, composer) {
        if ($isFunction(callback.dispatch)) {
            return callback.dispatch(handler, greedy, composer);
        }
        return handles.dispatch(handler, callback, null, composer, greedy);   
    } 
});

export const CovariantPolicy = CallbackPolicy.extend({
    constructor(name) {
        this.base(Variance.Covariant, name);
    },

    acceptResult(result) {
        return (result != null) && (result !== $unhandled);
    },
    compareBinding(binding, otherBinding) {
        validateComparer(binding, otherBinding);
        if (otherBinding.match(binding.constraint, Variance.Invariant)) {
            return 0;
        } else if (otherBinding.match(binding.constraint, Variance.Covariant)) {
            return -1;
        }
        return 1;      
    }
});

export const ContravariantPolicy = CallbackPolicy.extend({
    constructor(name) {
        this.base(Variance.Contravariant, name);
    },

    acceptResult(result) {
       return result !== $unhandled;
    },
    compareBinding(binding, otherBinding) {
        validateComparer(binding, otherBinding);
        if (otherBinding.match(binding.constraint, Variance.Invariant)) {
            return 0;
        } else if (otherBinding.match(binding.constraint, Variance.Contravariant)) {
            return -1;
        }
        return 1;        
    }
});

export const InvariantPolicy = CallbackPolicy.extend({
    constructor(name) {
        this.base(Variance.Invariant, name);
    },

    acceptResult(result) {
        return (result != null) && (result !== $unhandled);
    },
    compareBinding(binding, otherBinding) {
        validateComparer(binding, otherBinding);
        return otherBinding.match(binding.constraint, Variance.Invariant) ? 0 : -1;    
    }
});

function addHandler(owner, constraint, handler, removed) {
    if ($isNothing(owner)) {
        throw new Error("The owner argument is required.");
    } else if ($isNothing(handler)) {
        handler    = constraint;
        constraint = $classOf($contents(constraint));
    }
    if ($isNothing(handler)) {
        throw new Error("The handler argument is required.");
    }
    if (removed && !$isFunction(removed)) {
        throw new TypeError("The removed argument is not a function.");
    }
    if (!$isFunction(handler)) {
        handler = $lift($contents(handler));
    }
    const descriptor = HandlerDescriptor.get(owner, true);
    return descriptor.addBinding(this, constraint, handler, removed);
};

function validateComparer(binding, otherBinding) {
    if ($isNothing(binding)) {
        throw new Error("The binding argument is required.");
    }
    if ($isNothing(otherBinding)) {
        throw new Error("The otherBinding argument is required.");
    }
}

/**
 * Registers methods and properties as handlers.
 * @method addHandler
 * @param  {String}         name         - policy name
 * @param  {CallbackPolicy} policy       - the policy
 * @param  {Object}         [allowGets]  - true to allow property handlers
 * @param  {Function}       [filter]     - optional callback filter
 */
function registerHandlers(name, policy, allowGets, filter) {
    if ($isNothing(policy)) {
        throw new Error(`The policy for @${name} is required.`);
    }
    return (target, key, descriptor, constraints) => {
        // Base2 classes can have constructor decorators, but real classes
        // can't.  Therefore, we must allow decorators on classes too.
        if (!isDescriptor(descriptor)) {
            policy.addHandler(target, target, instantiate);
            return;
        }
        if (key === "constructor") {    
            policy.addHandler(target, "#constructor", instantiate);
            return;
        }
        const { get, value } = descriptor;
        if (!$isFunction(value)) {
            if (allowGets) {
                if (!$isFunction(get)) {
                    throw new SyntaxError(`@${name} can only be applied to methods and getters.`);
                }
            } else {
                throw new SyntaxError(`@${name} can only be applied to methods.`);
            }
        }
        if (constraints.length == 0) {
            if (policy.variance === Variance.Contravariant) {
                const signature = design.get(target, key);
                constraints = signature ? signature[0] : null;
            } else if (policy.variance === Variance.Covariant ||
                       policy.variance === Variance.Invariant) {
                const signature = designWithReturn.get(target, key);
                constraints = signature ? signature[0] : null;
            } else {
                constraints = null;
            }
        }
        function lateBinding() {
            const result = this[key];
            if ($isFunction(result)) {
                return result.apply(this, arguments);
            }
            return allowGets ? result : $unhandled;
        }
        const handler = $isFunction(filter) ? function () {
            return filter.apply(this, [key, ...arguments]) === false
                 ? $unhandled
                 : lateBinding.apply(this, arguments);
            } : lateBinding;
        handler.key = key;
        policy.addHandler(target, constraints, handler);
    };
}

function instantiate() { return new this(); }

/**
 * Policy for handling callbacks contravariantly.
 * @property {Function} handles
 */
export const handles = ContravariantPolicy.createDecorator("handles");

/**
 * Policy for providing instnces covariantly.
 * @property {Function} provides
 */        
export const provides = CovariantPolicy.createDecorator("provides", true);

/**
 * Policy for matching instances invariantly.
 * @property {Function} looksup
 */                
export const looksup = InvariantPolicy.createDecorator("looksup", true);
