import {
    Enum, design, instanceOf, $isNothing,
    $isFunction, $isSymbol, $isPlainObject,
    $classOf, getPropertyDescriptors, emptyArray
} from "miruken-core";

import { mapping } from "./mapping";
import { AbstractMapping } from "./abstract-mapping";
import { mapsFrom, mapsTo, format } from "./maps";

import { 
    TypeIdHandling, typeInfo, typeId
} from "../api/type-id";

export const JsonFormat            = Symbol("json"),
             DefaultTypeIdProperty = "$type";

/**
 * Handler for mapping to or from json values.
 * @class JsonMapping
 * @extends AbstractMapping
 */
@format(JsonFormat, /application[/]json/)
export class JsonMapping extends AbstractMapping {
    @mapsFrom(Date)
    mapFromDate(mapFrom) {
        return mapFrom.object.toJSON();
    }

    @mapsFrom(RegExp)
    mapFromRegExp(mapFrom) {
        return mapFrom.object.toString();
    }

    @mapsFrom(Array)
    mapFromArray(mapFrom, { composer }) {
        const array     = mapFrom.object,
              format    = mapFrom.format,
              configure = mapFrom.copyOptions.bind(mapFrom);
        return array.map(elem => composer.mapFrom(elem, format, configure)); 
    }
    
    mapsFrom(mapFrom, { composer }) {
        const { object, fields } = mapFrom;

        if (!canMapJson(object)) return;
        if (this.isPrimitiveValue(object)) {
            return object?.valueOf();
        }

        const raw       = $isPlainObject(object),
              allFields = $isNothing(fields) || fields === true;  
        if (!(allFields || $isPlainObject(fields))) {
            throw new Error(`Invalid map fields specifier ${fields}.`);
        }

        if (raw || $isFunction(object.toJSON)) {
            const json = raw ? object : object.toJSON();
            if (!allFields) {
                const j = {};
                for (let k in fields) j[k] = json[k];
                return j;
            }
            return json;
        }

        const descriptors = getPropertyDescriptors(object),
              { format, type, typeIdHandling } = mapFrom,
              json = {};

        if (shouldEmitTypeId(object, type, typeIdHandling)) {
            const id = typeId.getId(object);
            if (!$isNothing(id)) {
                const type = $classOf(object),
                typeIdProp = typeInfo.get(type)?.typeIdProperty 
                          || DefaultTypeIdProperty;
                json[typeIdProp] = id;
            }
        }

        Reflect.ownKeys(descriptors).forEach(key => {
            if (allFields || (key in fields)) {
                let keyValue = object[key];
                if (!canMapJson(keyValue)) return;
                const map = mapping.get(object, key);
                if (map?.ignore) return;
                if (this.isPrimitiveValue(keyValue)) {
                    json[key] = keyValue?.valueOf();
                    return;
                }
                let keyFields;
                if (!allFields) {
                    keyFields = fields[key];
                    if (keyFields === false) return;
                    if (!$isPlainObject(keyFields)) {
                        keyFields = undefined;
                    }
                }
                const keyJson = composer.mapFrom(keyValue, format, m => {
                    m.fields         = keyFields;
                    m.typeIdHandling = typeIdHandling;
                    if (typeIdHandling === TypeIdHandling.Auto) {
                        m.type = design.get(object, key)?.propertyType?.type;
                    }
                });
                if (map?.root) {
                    Object.assign(json, keyJson);
                } else {                 
                    json[key] = keyJson;
                }
            }
        });

        return json;
    }

    @mapsTo(Date)
    mapToDate(mapTo) {
        const date = mapTo.value;
        return instanceOf(date, Date) ? date : Date.parse(date);
    }

    @mapsTo(RegExp)
    mapToRegExp(mapTo) {
        const pattern   = mapTo.value,
              fragments = pattern.match(/\/(.*?)\/([gimy])?$/);              
        return new RegExp(fragments[1], fragments[2] || "")
    }

    @mapsTo(Array)
    mapToArray(mapTo, { composer }) {
        const array     = mapTo.value,
              format    = mapTo.format,
              configure = mapTo.copyOptions.bind(mapTo);
        let type = mapTo.classOrInstance;
        type = Array.isArray(type) ? type[0] : undefined;
        return array.map(elem => composer.mapTo(elem, format, type, configure)); 
    }

    mapsTo(mapTo, { composer }) {
        const { value, classOrInstance } = mapTo;
        if (!canMapJson(value)) return;
        if (this.isPrimitiveValue(value)) {
            return classOrInstance?.prototype instanceof Enum
                 ? classOrInstance.fromValue(value)
                 : value;
        }
        if ($isNothing(classOrInstance)) return;

        const { format, dynamic, ignoreCase } = mapTo,
              object      = createInstance(value, classOrInstance),
              descriptors = getPropertyDescriptors(object),
              copyOptions = mapTo.copyOptions.bind(mapTo);

        Reflect.ownKeys(descriptors).forEach(key => {
            const descriptor = descriptors[key];
            if (this.canSetProperty(descriptor)) {
                const map = mapping.get(object, key);
                if (map?.root) {
                    mapKey.call(this, object, key, value, composer, format, copyOptions);
                }
            }
        });

        for (let key in value) {
            const descriptor = descriptors[key];
            let   map        = mapping.get(object, key);
            if (map?.root || map?.ignore) {
                continue;  // ignore or already rooted
            }
            const keyValue = value[key];
            if (keyValue === undefined) continue;
            if (descriptor) {
                if (this.canSetProperty(descriptor)) {
                    mapKey.call(this, object, key, keyValue, composer, format, copyOptions);
                }
            } else {
                const lkey  = key.toLowerCase();
                let   found = false;
                for (let k in descriptors) {
                    if (k.toLowerCase() === lkey) {
                        if (this.canSetProperty(descriptors[k])) {                        
                            mapKey.call(this, object, k, keyValue, composer, format, copyOptions);
                        }
                        found = true;
                        break;
                    }
                }
                if (!found && dynamic) {
                    object[key] = keyValue;
                }
            }
        }

        return object;
    }
}

function canMapJson(value) {
    return value !== undefined && !$isFunction(value) && !$isSymbol(value);
}

function shouldEmitTypeId(object, type, typeIdHandling) {
    return typeIdHandling === TypeIdHandling.Always ||
           (typeIdHandling === TypeIdHandling.Auto  &&
            $classOf(object) !== type);
}

function createInstance(value, classOrInstance) {
    const isClass        = $isFunction(classOrInstance),
          type           = isClass ? classOrInstance : $classOf(classOrInstance),
          typeIdProperty = typeInfo.get(type) || DefaultTypeIdProperty,
          id             = value[typeIdProperty];
    if ($isNothing(id)) {
        return isClass ? Reflect.construct(type, emptyArray) : classOrInstance;
    }
    const desiredType = typeId.getType(id);
    if ($isNothing(desiredType)) {
        throw new Error(`The type with id '${id}' could not be resolved.`);
    }
    if (isClass) {
        return Reflect.construct(desiredType, emptyArray)
    }
    if (!(classOrInstance instanceof desiredType)) {
        throw new TypeError(`Expected instance of type ${desiredType.name}, but received ${type.name}.`);
    }
    return classOrInstance;
}

function mapKey(target, key, value, composer, format, configure) {
    const type = design.get(target, key)?.propertyType?.type;
    if ($isNothing(type)) {
        target[key] = this.isPrimitiveValue(value) ? value?.valueOf() : value;
    } else {
        target[key] = composer.mapTo(value, format, type, configure);
    }
}
