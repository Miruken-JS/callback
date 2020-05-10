import {
    Undefined, Base, Variance, Modifier,
    decorate, isDescriptor, designWithReturn,
    $isNothing, $isFunction, $classOf, $use, $lift
} from "miruken-core";

import HandlerDescriptor from "./handler-descriptor";

const policies = {};

/**
 * Sentinel indicating callback not handled.
 */                
export function $unhandled(result) {
    return result === $unhandled;
}

/**
 * Policy for handling callbacks contravariantly.
 * @property {Function} $handle
 */
export const $handle = $policy(Variance.Contravariant, "handle");

export function handles(...args) {
    return decorate(addPolicy("handle", $handle), args);
}

/**
 * Policy for providing callbacks covariantly.
 * @property {Function} $provide  
 */        
export const $provide = $policy(Variance.Covariant, "provide");

export function provides(...args) {
    return decorate(addPolicy("provide", $provide, true), args);
}

/**
 * Policy for matching callbacks invariantly.
 * @property {Function} $lookup  
 */                
export const $lookup = $policy(Variance.Invariant, "lookup");

export function looksup(...args) {
    return decorate(addPolicy("lookup", $lookup, true), args);    
}

/**
 * Marks methods and properties as handlers.
 * @method addPolicy
 * @param  {String}    name         - policy name
 * @param  {Object}    provider     - policy provider
 * @param  {Object}    [allowGets]  - true to allow property handlers
 * @param  {Function}  [filter]     - optional callback filter
 */
export function addPolicy(name, provider, allowGets, filter) {
    if (!provider) {
        throw new Error(`Provider for @${name} is required.`);
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
            if (provider.variance === Variance.Covariant ||
                provider.variance === Variance.Invariant) {
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
        provider(target, constraints, handler);
    };
}

/**
 * Defines a new callback policy.
 * This is the main extensibility point for handling callbacks.
 * @method $policy
 * @param   {Variance}  [variance=Variance.Contravariant]  -  policy variance 
 * @param   {Object}    description                        -  policy description
 * @return  {Function}  function to register with policy
 */
export function $policy(variance, description) {
    if ($isNothing(description)) {
        throw new Error("$policy requires a description.");
    }

    variance = variance || Variance.Contravariant;
    if (!(variance instanceof Variance)) {
        throw new TypeError("$policy expects a Variance parameter.");
    }

    let acceptResult, comparer;
    
    switch (variance) {
    case Variance.Covariant:
        acceptResult = requiresResult;
        comparer     = compareCovariant; 
        break;
    case Variance.Contravariant:
        acceptResult = impliesSuccess;
        comparer     = compareContravariant; 
        break;
    case Variance.Invariant:
        acceptResult = requiresResult;
        comparer     = compareInvariant; 
        break;
    }

    function policy(owner, constraint, handler, removed) {
        if (Array.isArray(constraint)) {
            if (constraint.length == 1) {
                constraint = constraint[0];
            } else {
                return constraint.reduce((result, c) => {
                    const undefine = _policy(owner, c, handler, removed);
                    return notifyRemoved => {
                        result(notifyRemoved);
                        undefine(notifyRemoved);
                    };
                }, Undefined);
            }
        }
        return _policy(owner, constraint, handler, removed);
    }
    function _policy(owner, constraint, handler, removed) {
        if ($isNothing(owner)) {
            throw new TypeError("Policies must have an owner.");
        } else if ($isNothing(handler)) {
            handler    = constraint;
            constraint = $classOf(Modifier.unwrap(constraint));
        }
        if ($isNothing(handler)) {
            throw new TypeError(
                `Incomplete policy: missing handler for constraint ${constraint}`);
        } else if (removed && !$isFunction(removed)) {
            throw new TypeError("The removed argument is not a function.");
        }
        if (!$isFunction(handler)) {
            const source = $use.test(handler) ? Modifier.unwrap(handler) : handler;
            handler = $lift(source);
        }
        const descriptor = HandlerDescriptor.get(owner, true);
        return descriptor.addBinding(policy, constraint, handler, removed);
    };
    policy.dispatch = function (handler, callback, constraint, composer, all, results) {
        const descriptor = HandlerDescriptor.get(handler);
        return descriptor != null && descriptor.dispatch(
            policy, handler, callback, constraint, composer, all, results);
    };
    policy.description  = description;
    policy.variance     = variance;
    policy.acceptResult = acceptResult;
    policy.comparer     = comparer; 
    Object.freeze(policy);
    return policies[policy] = policy;
}

$policy.dispatch = function (handler, callback, greedy, composer) {
    if ($isFunction(callback.dispatch)) {
        return callback.dispatch(handler, greedy, composer);
    }
    return $handle.dispatch(handler, callback, null, composer, greedy);       
};

function compareCovariant(binding, insert) {
    if (insert.match(binding.constraint, Variance.Invariant)) {
        return 0;
    } else if (insert.match(binding.constraint, Variance.Covariant)) {
        return -1;
    }
    return 1;
}

function compareContravariant(binding, insert) {
    if (insert.match(binding.constraint, Variance.Invariant)) {
        return 0;
    } else if (insert.match(binding.constraint, Variance.Contravariant)) {
        return -1;
    }
    return 1;
}

function compareInvariant(binding, insert) {
    return insert.match(binding.constraint, Variance.Invariant) ? 0 : -1;
}

function requiresResult(result) {
    return ((result != null) && (result !== $unhandled));
}

function impliesSuccess(result) {
    return result !== $unhandled;
}
