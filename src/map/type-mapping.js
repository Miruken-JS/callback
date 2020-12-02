import {
    Enum, Metadata, decorate,
    $isNothing, $isFunction, $isString
} from "miruken-core";

import { Handler } from "../handler";
import { ignore } from  "./mapping";
import { mapsTo, format } from "./maps";

export const TypeIdFormat = Symbol("type");

@format(TypeIdFormat)
export class TypeMapping extends Handler {}

const TypeIdResolver      = Symbol("type-id"),
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
            function getter() { return id; }
            Object.defineProperty(target, TypeIdResolver, {
                configurable: false,
                enumerable:   false,
                value:        getter
            });
            Object.defineProperty(target.prototype, TypeIdResolver, {
                configurable: false,
                enumerable:   false,
                value:        getter
            });
            addTypeMapping(target, id);
        } else {
            let getter;
            const { get, value } = descriptor;
            if ($isFunction(get)) {
                getter = get;
                ignore(target, key, descriptor);
            } else if ($isFunction(value)) {
                getter = value;
            } else {
                throw new SyntaxError("@typeId can only be applied to classes, getters or methods.");
            } 
            Object.defineProperty(target, TypeIdResolver, {
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

typeId.get = function (target) {
    return target?.[TypeIdResolver]?.();
}

/**
 * Maintains type information for a class.
 * @method typeInfo
 * @param  {String}  property  -  member mapping
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

Handler.implement({
    getTypeFromId(typeId) {
        if (!$isString(typeId)) {
            throw new Error(`Invalid type id '${typeId}'.`);
        }
        const stripped = typeId.replace(/\s+/g, '');
        return this.mapTo(stripped, TypeIdFormat);
    }
});

function addTypeMapping(type, id) {
    const method   = Symbol(),
          handler  = { [method] () { return type; } };
    Object.defineProperty(handler, method,
        Reflect.decorate([mapsTo(id)], handler, method,
            Object.getOwnPropertyDescriptor(handler, method)));
    TypeMapping.implement(handler);
}
