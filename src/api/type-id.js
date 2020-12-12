import {
    Enum, Metadata, decorate,
    $isNothing, $isFunction, $isString,
    $classOf
} from "miruken-core";

import { Handler } from "../handler";
import { mapsTo, format } from "../map/maps";
import { ignore } from  "../map/mapping";

const idToType            = new Map(),
      typeToId            = new WeakMap(),
      typeIdResolver      = Symbol("type-id"),
      typeInfoMetadataKey = Symbol("type-info-metadata");

export const TypeIdHandling = Enum({
    None:   0,  // Never
    Always: 1,  // Always
    Auto  : 2   // Include as needed
});

export function typeId(...args) {
    return decorate((target, key, descriptor, args) => {
        if ($isNothing(descriptor)) {
            let [id] = args;
            if ($isNothing(id) || id === "") {
                id = target.name;
                if (id === "_class") {
                    throw new Error("@typeId cannot be inferred from a base2 class.  Please specify it explicitly.");
                }
            } else if (!$isString(id)) {
                throw new SyntaxError("@typeId expects a string identifier.");
            } else {
                id = id.replace(/\s+/g, '')
            }
            idToType.set(id, new WeakRef(target));
            typeToId.set(target, id);
        } else {
            let getter;
            const { get, value } = descriptor;
            if ($isFunction(get)) { // late binding
                getter = function () { return this[key]; };
                ignore(target, key, descriptor);
            } else if ($isFunction(value)) {  // late binding
                getter = function () { return this[key]?.call(this); };
            } else {
                throw new SyntaxError("@typeId can only be applied to classes, getters or methods.");
            }
            Object.defineProperty(target, typeIdResolver, {
                configurable: false,
                enumerable:   false,
                value:        function () { 
                    const id = getter.call(this);
                    if (!$isString(id)) {
                        throw new Error(`@typeId getter '${key}' returned invalid identifier ${id}.`);
                    }
                    return id;
                }
            });
        }
    }, args);
}

typeId.getId = function (target) {
    if ($isNothing(target)) {
        throw new Error("The target is required.")
    }
    const resolver = target[typeIdResolver];
    if ($isFunction(resolver)) {
        return resolver.call(target);
    }
    const type = $isFunction(target) ? target : $classOf(target),
          id   = typeToId.get(type);
    return $isFunction(id) ? id.call(target) : id;
}

typeId.getType = function (id) {
    if (!$isString(id)) {
        throw new Error(`Invalid type id '${id}'.`);
    }
    const stripped = id.replace(/\s+/g, ''),
          weakType = idToType.get(stripped);
    if (!$isNothing(weakType)) {
        const type = weakType.deref();
        if (!$isNothing(type)) return type;
        idToType.delete(stripped);
    }
}

/**
 * Maintains type information for a class.
 * @method typeInfo
 * @param  {String} typeIdProperty  -  member mapping
 */  
export const typeInfo = Metadata.decorator(typeInfoMetadataKey,
    (target, key, descriptor, [typeIdProperty]) => {
        if (!$isNothing(descriptor)) {
            throw new SyntaxError("@typeInfo can only be applied to a class.");
        }
        if (!$isString(typeIdProperty)) {
            throw new Error(`The type id property '${typeIdProperty}' is not valid.`);
        }
        typeInfo.getOrCreateOwn(target, () => ({})).typeIdProperty = typeIdProperty;
    });
