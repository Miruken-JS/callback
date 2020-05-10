import {
    Variance, decorate, isDescriptor,
    designWithReturn, $isFunction
} from "miruken-core";

import {
    CallbackPolicy, $unhandled
} from "./callback-policy";

const policies = {};

/**
 * Policy for handling callbacks contravariantly.
 * @property {Function} $handle
 */
export const $handle = $policy(Variance.Contravariant, "handle");

export function handles(...args) {
    return decorate(addHandler("handle", $handle), args);
}

/**
 * Policy for providing callbacks covariantly.
 * @property {Function} $provide  
 */        
export const $provide = $policy(Variance.Covariant, "provide");

export function provides(...args) {
    return decorate(addHandler("provide", $provide, true), args);
}

/**
 * Policy for matching callbacks invariantly.
 * @property {Function} $lookup  
 */                
export const $lookup = $policy(Variance.Invariant, "lookup");

export function looksup(...args) {
    return decorate(addHandler("lookup", $lookup, true), args);    
}

/**
 * Marks methods and properties as handlers.
 * @method addHandler
 * @param  {String}         name         - policy name
 * @param  {CallbackPolicy} policy       - the policy
 * @param  {Object}         [allowGets]  - true to allow property handlers
 * @param  {Function}       [filter]     - optional callback filter
 */
export function addHandler(name, policy, allowGets, filter) {
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

/**
 * Defines a new callback policy.
 * This is the main extensibility point for handling callbacks.
 * @method $policy
 * @param   {Variance}  [variance=Variance.Contravariant]  -  policy variance 
 * @param   {Object}    description                        -  policy description
 * @return  {CallbackPolicy}  returns the new CallbackPolicy.
 */
export function $policy(variance, description) {
    const policy = CallbackPolicy.create(variance, description);
    return policies[policy] = policy;
}

$policy.dispatch = function (handler, callback, greedy, composer) {
    if ($isFunction(callback.dispatch)) {
        return callback.dispatch(handler, greedy, composer);
    }
    return $handle.dispatch(handler, callback, null, composer, greedy);       
};

