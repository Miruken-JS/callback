import {
    $handle, $provide, $NOT_HANDLED
} from './meta';

import {
    Variance, decorate, $isFunction
} from 'miruken-core';

const Everything = [null];

export function build(definition) {
    return function decorate(target, key, descriptor, constraints) {
        if (constraints.length === 0) {
            constraints = Everything;
        }
        if (definition && definition.tag) {
            const spec = target[definition.tag]
                      || (target[definition.tag] = []);
            function lateBinding() {
                const result = this[key];
                if ($isFunction(result)) {
                    return result.apply(this, arguments);
                }
                if (definition.variance == Variance.Covariant) {
                    return result;
                }
                return $NOT_HANDLED;
            }
            spec.push(constraints, lateBinding);
        }
        return descriptor;
    };
}

export function callback(definition, ...args) {
    if (definition == null) {
        definition = $handle;
    }
    return decorate(build(definition), args);
}

export function handle(...args) {
    return decorate(build($handle), args);
}

export function provide(...args) {
    return decorate(build($provide), args);    
}
