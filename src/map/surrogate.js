import {
    Metadata, $isNothing, $isFunction
} from "miruken-core";

const surrogateMetadataKey  = Symbol("surrogate-metadata");

/**
 * Maintains surrogate type information.
 * @method surrogate
 * @param  {Function}  actual  -  actual type
 */  
export const surrogate = Metadata.decorator(surrogateMetadataKey,
    (target, key, descriptor, [actual]) => {
        if (!$isNothing(descriptor)) {
            throw new SyntaxError("@surrogate can only be applied to classes.");
        }
        if (!$isFunction(actual)) {
            throw new TypeError("@surrogate requires the actual type.");
        }
        if (surrogate.getOrCreateOwn(target, () => actual) != actual) {
            throw new Error(`The surrogate for ${target.name} is already assigned ${actual.name}.`);
        }
        if (surrogate.getOrCreateOwn(actual, () => target) != target) {
            throw new Error(`The surrogate for ${actual.name} is already assigned ${target.name}.`)
        }
    });
