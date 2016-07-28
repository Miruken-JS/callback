import {
    $handle, $provide, $NOT_HANDLED
} from './meta';

import { $isFunction } from 'miruken-core';

const Everything = [null];

export function callback(definition, ...constraints) {
    function decorate(target, key, descriptor) {
        if (definition && definition.tag &&
            descriptor && descriptor.value) {
            const spec = target[definition.tag]
                      || (target[definition.tag] = []);
            function lateBinding(...args) {
                const method = this[key];
                return $isFunction(method)
                     ? method.apply(this, args)
                     : $NOT_HANDLED;
            }
            spec.push(constraints, lateBinding);
        }
        return descriptor;
    };
    if (constraints.length == 0) {
        constraints = Everything;
    } else if (constraints.length === 3 &&  isDescriptor(constraints[2])) {
        const [target, key, descriptor] = constraints; 
        constraints = Everything;
        return decorate(target, key, descriptor);
    }
    return decorate;
}

export function handle(...constraints) {
    return callback($handle, ...constraints);
}

export function provide(...constraints) {
    return callback($provide, ...constraints);
}

function isDescriptor(descriptor) {
    return 'value' in descriptor &&
           'enumerable' in descriptor &&
           'writable' in descriptor;
}
