import {
    $handle, $provide, $lookup, $NOT_HANDLED
} from "./definition";

import { decorate, $isFunction } from "miruken-core";

/**
 * Marks methods and properties as handlers.
 * @method validate
 * @param  {Object}  def        - definition provider
 * @param  {Object}  allowGets  - allow properties to be handlers
 */
export function addDefinition(def, allowGets) {
    if (!def) {  throw new Error("Definition is missing"); }
    if (!def.key) { throw new Error("Definition key is missing"); }
    return function (target, key, descriptor, constraints) {
        if (key !== "constructor") {
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
        }
        return descriptor;
    };
}

/**
 * Contravariant (in) handlers.
 */
export function handle(...args) {
    return decorate(addDefinition($handle), args);
}

/**
 * Covariant (out) handlers.
 */
export function provide(...args) {
    return decorate(addDefinition($provide, true), args);    
}

/**
 * Invariant (eq) handlers.
 */
export function lookup(...args) {
    return decorate(addDefinition($lookup, true), args);    
}
