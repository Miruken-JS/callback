import {
    Metadata, $isNothing, $isFunction,
    $isPlainObject
} from "miruken-core";

const mappingMetadataKey  = Symbol("mapping-metadata");

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
    mapping.getOrCreateOwn(target, key, () => ({})).root = true; 
}

/**
 * Marks the property to be ignored by the mapping.
 * @method ignore
 */
export function ignore(target, key, descriptor) {
    mapping.getOrCreateOwn(target, key, () => ({})).ignore = true;
}
