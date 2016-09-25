import {
    $handle, $provide, $lookup, $NOT_HANDLED
} from "./definition";

import {
    decorate, isDescriptor, $isFunction
} from "miruken-core";

/**
 * Marks methods and properties as handlers.
 * @method validate
 * @param  {Object}  name       - definition name
 * @param  {Object}  def        - definition provider
 * @param  {Object}  allowGets  - allow properties to be handlers
 */
export function addDefinition(name, def, allowGets) {
    if (!def) {
        throw new Error(`Definition for @${name} is missing`);
    }
    if (!def.key) {
        throw new Error(`Invalid definition @${name}: key is missing`);
    }
    return (target, key, descriptor, constraints) => {
        if (!isDescriptor(descriptor)) {
            throw new SyntaxError(`@${name} cannot be applied to classes`);
        }
        if (key === "constructor") {
            throw new SyntaxError(`@${name} cannot be applied to constructors`);
        }
        const { get, value } = descriptor;
        if (!$isFunction(value)) {
            if (allowGets) {
                if (!$isFunction(get)) {
                    throw new SyntaxError(`@${name} can only be applied to methods and getters`);
                }
            } else {
                throw new SyntaxError(`@${name} can only be applied to methods`);
            }
        }
        if (constraints.length === 0) {
            constraints = null;
        }
        function lateBinding() {
            const result = this[key];
            if ($isFunction(result)) {
                return result.apply(this, arguments);
            }
            return allowGets ? result : $NOT_HANDLED;                
        }
        lateBinding.key = key;
        def(target, constraints, lateBinding);
    };
}

/**
 * Contravariant (in) handlers.
 */
export function handle(...args) {
    return decorate(addDefinition("handle", $handle), args);
}

/**
 * Covariant (out) handlers.
 */
export function provide(...args) {
    return decorate(addDefinition("provide", $provide, true), args);    
}

/**
 * Invariant (eq) handlers.
 */
export function lookup(...args) {
    return decorate(addDefinition("lookup", $lookup, true), args);    
}
