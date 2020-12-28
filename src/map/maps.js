import {
    Metadata, $isNothing, $isFunction,
    $isString, $equals
} from "miruken-core";

import { 
    CovariantPolicy, ContravariantPolicy
} from "../callback-policy";

const formatMetadataKey = Symbol("map-format");

/**
 * Policy for mapping a value to a format.
 * @property {Function} mapsFrom
 */   
export const mapsFrom = ContravariantPolicy.createDecorator(
    "mapsFrom", { filter: filterFormat });

/**
 * Policy for mapping from a formatted value.
 * @property {Function} mapsTo
 */   
export const mapsTo = ContravariantPolicy.createDecorator(
    "mapsTo", { filter: filterFormat });

/**
 * Mapping formats.
 * @method format
 * @param {Array}  ...formats  -  mapping formats 
 */
export const format = Metadata.decorator(formatMetadataKey,
    (target, key, descriptor, formats) => {
        formats = formats.flat();
        if (formats.length === 0) return;
        const metadata = $isNothing(descriptor)
            ? format.getOrCreateOwn(target.prototype, () => new Set())
            : format.getOrCreateOwn(target, key, () => new Set());
        formats.forEach(format => metadata.add(format));
    });

function filterFormat(key, mapCallback) {
    const prototype = Object.getPrototypeOf(this);
    let formats = format.get(prototype, key);
    if ($isNothing(formats) || formats.size === 0) {
        formats = format.get(prototype);        
    }
    return !formats || formats.size === 0 ||
        [...formats].some(f => {
            const format = mapCallback.format;
            if (f instanceof RegExp) {
                return $isString(format) && f.test(format)
            }
            return $equals(format, f);
        });
}
