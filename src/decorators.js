import {
    $handle, $provide, $NOT_HANDLED
} from './meta';

import {
    Variance, decorate, $isFunction
} from 'miruken-core';

const Everything = [null];

export function addDefinition(def, allowGets) {
    return function decorate(target, key, descriptor, constraints) {
        if (def && def.tag) { 
            if (constraints.length === 0) {
                constraints = Everything;
            }
            const spec = target[def.tag] || (target[def.tag] = []);
            function lateBinding() {
                const result = this[key];
                if ($isFunction(result)) {
                    return result.apply(this, arguments);
                }
                return allowGets ? result : $NOT_HANDLED;
            }
            spec.push(constraints, lateBinding);
        }
        return descriptor;
    };
}

export function handle(...args) {
    return decorate(addDefinition($handle), args);
}

export function provide(...args) {
    return decorate(addDefinition($provide, true), args);    
}
