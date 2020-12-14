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
        const object = mapFrom.object;

        if (!canMapJson(object)) return;
        if (this.isPrimitiveValue(object)) {
            return object?.valueOf();
        }

        const raw       = $isPlainObject(object),
              fields    = mapFrom.fields,
              allFields = $isNothing(fields) || fields === true;  
        if (!(allFields || $isPlainObject(fields))) {
            throw new Error(`Invalid map fields specifier ${fields}.`);
        }

        if (raw || $isFunction(object.toJSON)) {
            return raw ? object : object.toJSON();
        }

        const descriptors = getPropertyDescriptors(object),
              { format, strategy, type, typeIdHandling } = mapFrom,
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
                const map      = mapping.get(object, key),
                      property = getProperty(object, key, map, strategy),
                      keyValue = object[key];
                if (!canMapJson(keyValue)) return;
                if (map?.ignore) return;
                if (this.isPrimitiveValue(keyValue)) {
                    json[property] = keyValue?.valueOf();
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
                    json[property] = keyJson;
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

        const object = createInstance(value, classOrInstance),
            { format, strategy } = mapTo,
              descriptors = getPropertyDescriptors(object),
              copyOptions = mapTo.copyOptions.bind(mapTo);

        Reflect.ownKeys(descriptors).forEach(key => {
            const descriptor = descriptors[key];
            if (this.canSetProperty(descriptor)) {
                const map      = mapping.get(object, key),
                      property = getProperty(classOrInstance, key, map, strategy);
                if (map?.root) {
                    mapKey.call(this, object, key, value, composer, format, copyOptions);
                } else if (!map?.ignore) {
                    const keyValue = value[property];
                    if (keyValue !== undefined) {
                        mapKey.call(this, object, key, keyValue, composer, format, copyOptions);
                    }
                }
            }
        });

        return object;
    }
}

function canMapJson(value) {
    return value !== undefined && !$isFunction(value) && !$isSymbol(value);
}

function getProperty(target, key, map, strategy, reading) {
    return map?.property || 
           strategy?.getPropertyName(target, key, reading) ||
           key;
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
