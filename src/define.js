import {
    $handle, $provide, $lookup, $NOT_HANDLED
} from './meta';

import { decorate, $isFunction } from 'miruken-core';

/**
 * Marks methods and properties as handlers.
 * @method validate
 * @param  {Object}  def        - definition provider
 * @param  {Object}  allowGets  - allow properties to be handlers
 */
export function addDefinition(def, allowGets) {
    return function (target, key, descriptor, constraints) {
        if (def && def.tag && key !== 'constructor') {
            if (constraints.length === 0) {
                constraints = null;
            }
            def(target, constraints, lateBinding);
            function lateBinding() {
                const result = this[key];
                if ($isFunction(result)) {
                    return result.apply(this, arguments);
                }
                return allowGets ? result : $NOT_HANDLED;
            }
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
 * Invariant handlers.
 */
export function lookup(...args) {
    return decorate(addDefinition($lookup, true), args);    
}
