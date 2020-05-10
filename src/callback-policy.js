import { 
    Base, Undefined, Variance, Modifier,
    decorate, isDescriptor, designWithReturn,
    $isNothing, $isFunction, $classOf, $use,
    $lift, createKey
} from "miruken-core";

import { HandlerDescriptor } from "./handler-descriptor";

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
    * @param   {Variance}  [variance=Variance.Contravariant]  -  policy variance 
    * @param   {String}    description                        -  policy description
    */    
    constructor(variance, description) {
        if ($classOf(this) === CallbackPolicy) {
            throw new Error("CallbackPolicy cannot be instantiated.");
        }

        _(this).variance    = variance;
        _(this).description = description;
    },

    get variance()    { return _(this).variance; },
    get description() { return _(this).description; },

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
            constraint = $classOf(Modifier.unwrap(constraint));
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

    dispatch (handler, callback, constraint, composer, all, results) {
        const descriptor = HandlerDescriptor.get(handler);
        return descriptor != null && descriptor.dispatch(
            this, handler, callback, constraint, composer, all, results);
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
    * Creates a new callback policy.
    * @method create
    * @param   {Variance}  [variance=Variance.Contravariant]  -  policy variance 
    * @param   {String}    description                        -  policy description
    * @return  {CallbackPolicy}  returns the new CallbackPolicy.
    */
    create(variance, description) {
        if ($isNothing(variance)) {
            throw new Error("The variance argument is required.");
        }

        if ($isNothing(description)) {
            throw new Error("The description argument is required.");
        }

        if (!(variance instanceof Variance)) {
            throw new TypeError("Invalid variance parameter.");
        }

        switch (variance) {
            case Variance.Covariant:
                return new CovariantPolicy(description);
            case Variance.Contravariant:
                return new ContravariantPolicy(description);
            case Variance.Invariant:
                return new InvariantPolicy(description);
        }    
    },
    dispatch(handler, callback, greedy, composer) {
        if ($isFunction(callback.dispatch)) {
            return callback.dispatch(handler, greedy, composer);
        }
        return $handle.dispatch(handler, callback, null, composer, greedy);   
    } 
});

export const CovariantPolicy = CallbackPolicy.extend({
    constructor(description) {
        this.base(Variance.Covariant, description)
    },

    acceptResult(result) {
        return (result != null) && (result !== $unhandled);
    },
    compareBinding(binding, otherBinding) {
        validateCompareArguments(binding, otherBinding);
        if (otherBinding.match(binding.constraint, Variance.Invariant)) {
            return 0;
        } else if (otherBinding.match(binding.constraint, Variance.Covariant)) {
            return -1;
        }
        return 1;      
    }
});

export const ContravariantPolicy = CallbackPolicy.extend({
    constructor(description) {
        this.base(Variance.Contravariant, description)
    },

    acceptResult(result) {
       return result !== $unhandled;
    },
    compareBinding(binding, otherBinding) {
        validateCompareArguments(binding, otherBinding);
        if (otherBinding.match(binding.constraint, Variance.Invariant)) {
            return 0;
        } else if (otherBinding.match(binding.constraint, Variance.Contravariant)) {
            return -1;
        }
        return 1;        
    }
});

export const InvariantPolicy = CallbackPolicy.extend({
    constructor(description) {
        this.base(Variance.Invariant, description)
    },

    acceptResult(result) {
        return (result != null) && (result !== $unhandled);
    },
    compareBinding(binding, otherBinding) {
        validateCompareArguments(binding, otherBinding);
        return otherBinding.match(binding.constraint, Variance.Invariant) ? 0 : -1;    
    }
});

function addHandler(owner, constraint, handler, removed) {
    if ($isNothing(owner)) {
        throw new Error("The owner argument is required.");
    } else if ($isNothing(handler)) {
        handler    = constraint;
        constraint = $classOf(Modifier.unwrap(constraint));
    }
    if ($isNothing(handler)) {
        throw new Error("The handler argument is required.");
    }
    if (removed && !$isFunction(removed)) {
        throw new TypeError("The removed argument is not a function.");
    }
    if (!$isFunction(handler)) {
        const source = $use.test(handler) ? Modifier.unwrap(handler) : handler;
        handler = $lift(source);
    }
    const descriptor = HandlerDescriptor.get(owner, true);
    return descriptor.addBinding(this, constraint, handler, removed);
};

/**
 * Registers methods and properties as handlers.
 * @method addHandler
 * @param  {String}         name         - policy name
 * @param  {CallbackPolicy} policy       - the policy
 * @param  {Object}         [allowGets]  - true to allow property handlers
 * @param  {Function}       [filter]     - optional callback filter
 */
export function registerHandlers(name, policy, allowGets, filter) {
    if (!policy) {
        throw new Error(`The policy for @${name} is required.`);
    }
    return (target, key, descriptor, constraints) => {
        if (!isDescriptor(descriptor)) {
            throw new SyntaxError(`@${name} cannot be applied to classes.`);
        }
        if (key === "constructor") {
            throw new SyntaxError(`@${name} cannot be applied to constructors.`);
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
            if (policy.variance === Variance.Covariant ||
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

function validateCompareArguments(binding, otherBinding) {
    if ($isNothing(binding)) {
        throw new Error("The binding argument is required.");
    }
    
    if ($isNothing(otherBinding)) {
        throw new Error("The otherBinding argument is required.");
    }
}

/**
 * Policy for handling callbacks contravariantly.
 * @property {Function} $handle
 */
export const $handle = new ContravariantPolicy("handle");

export function handles(...args) {
    return decorate(registerHandlers("handle", $handle), args);
}

/**
 * Policy for providing callbacks covariantly.
 * @property {Function} $provide  
 */        
export const $provide = new CovariantPolicy("provide");

export function provides(...args) {
    return decorate(registerHandlers("provide", $provide, true), args);
}

/**
 * Policy for matching callbacks invariantly.
 * @property {Function} $lookup  
 */                
export const $lookup = new InvariantPolicy("lookup");

export function looksup(...args) {
    return decorate(registerHandlers("lookup", $lookup, true), args);    
}
