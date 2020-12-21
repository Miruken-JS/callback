import {
    Protocol, Metadata, $isNothing,
    $isFunction, $isPlainObject
} from "miruken-core";

const mappingMetadataKey  = Symbol("mapping-metadata");

export const Mapping = Protocol.extend({
    shouldIgnore(target, key) {},
    shouldUseEnumName(target, key) {},
    getPropertyName(target, key) {},
    getTypeIdProperty(target) {}
});

/**
 * Maintains mapping information for a class or property.
 * @method mapping
 * @param  {Object}  mapping  -  member mapping
 */  
export const mapping = Metadata.decorator(mappingMetadataKey,
    (target, key, descriptor, [mapping]) => {
        if (!$isPlainObjet(mapping)) {
            throw new TypeError("@mapping must be a simple object.");
        }
        Metadata.define(mappingMetadataKey, mapping, target, key);
    });

/**
 * Marks the property to be mapped from the root.
 * @method root
 */
export function root(target, key, descriptor) {
    validateProperty("root", key, descriptor);
    mapping.getOrCreateOwn(target, key, () => ({})).root = true; 
}

/**
 * Marks the property to be ignored by the mapping.
 * @method ignore
 */
export function ignore(target, key, descriptor) {
    validateProperty("ignore", key, descriptor);
    mapping.getOrCreateOwn(target, key, () => ({})).ignore = true;
}

/**
 * Marks the property to use the alternate name.
 * @method property
 */
export function property(name) {
    if (!name) {
        throw new Error("@property requires a non-empty name.")
    }
    return (target, key, descriptor) =>
        validateProperty("property", key, descriptor);
        mapping.getOrCreateOwn(target, key, () => ({})).property = name;
}

function validateProperty(option, key, descriptor) {
    if ($isNothing(descriptor)) {
        throw new SyntaxError(`@${option} cannot be applied to classes.`);
    }
    const { get, set, initializer } = descriptor;
    if ($isNothing(get) && $isNothing(set) && $isNothing(initializer)) {
        throw new SyntaxError(`@${option} can only be applied to properties.`);
    }
}
