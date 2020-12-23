import {
    Enum, Either, design, instanceOf,
    emptyArray, $isNothing, $isFunction, $isSymbol,
    $isPlainObject, $classOf, getPropertyDescriptors
} from "miruken-core";

import { mapping } from "./mapping";
import { AbstractMapping } from "./abstract-mapping";
import { mapsFrom, mapsTo, format } from "./maps";
import { MapOptions } from "./map-options";
import { AnyObject } from "./any-object";
import { options } from "../options";

import { 
    TypeIdHandling, typeInfo, typeId
} from "../api/type-id";

export const JsonFormat = Symbol("json"),
             DefaultTypeIdProperty = "$type";

/**
 * Handler for mapping to or from json values.
 * @class JsonMapping
 * @extends AbstractMapping
 */
@format(JsonFormat, /application[/]json/)
export class JsonMapping extends AbstractMapping {
    @mapsFrom(Date)
    mapFromDate({ object }) {
        return object.toJSON();
    }

    @mapsFrom(RegExp)
    mapFromRegExp({ object }) {
        return object.toString();
    }

    @mapsFrom(Either)
    mapFromEither(mapFrom, @options(MapOptions) options, { composer }) {
        const { object, format, seen } = mapFrom,
              { strategy }             = options || {};
        function mapValue(value) {
            return $isNothing(value) ? null
                 : composer.$mapFrom(value, format, [...seen, object]);
        }
        const isLeftProperty = getProperty(object, "isLeft", null, strategy),
              valueProperty  = getProperty(object, "value", null, strategy);
        return object.fold(
            left => ({
                [isLeftProperty]: true,
                [valueProperty]:  mapValue(left)
            }),
            right => ({
                [isLeftProperty]: false,
                [valueProperty]:  mapValue(right)
            }));
    }

    @mapsFrom(Array)
    mapFromArray(mapFrom, { composer }) {
        const { object, format, seen } = mapFrom,
                seenArray = [...seen, object];
        return object.map(elem => composer.$mapFrom(elem, format, seenArray)); 
    }
    
    mapsFrom(mapFrom, options, { composer }) {
        const { object, format, seen } = mapFrom;

        if (!canMapJson(object)) return;
        if (this.isPrimitiveValue(object)) {
            return object?.valueOf();
        }

        if ($isFunction(object.toJSON)) {
            return object.toJSON();
        }

        const { fields, strategy, type, typeIdHandling } = options || {},
                allFields = $isNothing(fields) || fields === true;

        if (!(allFields || $isPlainObject(fields))) {
            throw new Error(`Invalid map fields specifier ${fields}.`);
        }

        const json = {};

        if (shouldEmitTypeId(object, type, typeIdHandling)) {
            const id = typeId.getId(object);
            if (!$isNothing(id)) {
                const type = $classOf(object),
                typeIdProp = typeInfo.get(type)?.typeIdProperty
                          || strategy?.getTypeIdProperty?.(type)
                          || DefaultTypeIdProperty;
                json[typeIdProp] = id;
            }
        }

        const descriptors = getPropertyDescriptors(object),
              seenObject  = [...seen, object];

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
                        keyFields = undefined;;
                    }
                }

                const keyJson = composer.$mapOptions({
                    fields: keyFields,
                    type:   typeIdHandling === TypeIdHandling.Auto
                            ? design.get(object, key)?.propertyType?.type
                            : null
                }).$mapFrom(keyValue, format, seenObject);

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
    mapToDate({ value }) {
        return instanceOf(value, Date) ? value : Date.parse(value);
    }

    @mapsTo(RegExp)
    mapToRegExp({ value }) {
        const fragments = value.match(/\/(.*?)\/([gimy])?$/);              
        return new RegExp(fragments[1], fragments[2] || "")
    }

    @mapsTo(Either)
    mapToEither(mapTo, @options(MapOptions) options, { composer }) {
        const { classOrInstance, seen } = mapTo;
        if (!$isFunction(classOrInstance)) {
            throw new Error("Either is immutable and cannot be mapped onto.");
        }
        const { value, format } = mapTo,
              { strategy }      = options || {},
                isLeftProperty  = getProperty(Either, "isLeft", null, strategy),
                valueProperty   = getProperty(Either, "value", null, strategy),
                eitherValue     = value[valueProperty];
        const eitherObject = $isNothing(eitherValue) ? null
              : composer.$mapTo(eitherValue, format, null, [...seen, value]);
        return value[isLeftProperty] === true
             ? Either.left(eitherObject)
             : Either.right(eitherObject);
    }

    @mapsTo(Array)
    mapToArray(mapTo, { composer }) {
        const { value, format, seen } = mapTo,
                seenArray = [...seen, value];
        let type = mapTo.classOrInstance;
        type = Array.isArray(type) ? type[0] : undefined;
        return value.map(elem => composer.$mapTo(elem, format, type, seenArray)); 
    }

    mapsTo(mapTo, options, { composer }) {
        const { value, format, classOrInstance, seen } = mapTo;
        if (!canMapJson(value)) return;
        if (this.isPrimitiveValue(value)) {
            if (classOrInstance instanceof Enum) {
                throw new Error("Enum is immutable and cannot be mapped onto.");
            }
            return classOrInstance?.prototype instanceof Enum
                 ? classOrInstance.fromValue(value)
                 : value;
        }

        const { strategy }  = options || {},
                object      = getOrCreateObject(value, classOrInstance, strategy),
                type        = $classOf(object),
                seenValue   = [...seen, value],
                descriptors = getPropertyDescriptors(object);

        Reflect.ownKeys(descriptors).forEach(key => {
            const descriptor = descriptors[key];
            if (this.canSetProperty(descriptor)) {
                const map      = mapping.get(object, key),
                      property = getProperty(type, key, map, strategy);
                if (map?.root) {
                    mapKey.call(this, object, key, value, composer, format, seen);
                } else if (!map?.ignore) {
                    const keyValue = value[property];
                    if (keyValue !== undefined) {
                        mapKey.call(this, object, key, keyValue, composer, format, seenValue);
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

function getOrCreateObject(value, classOrInstance, strategy) {
    const isClass        = $isFunction(classOrInstance),
          type           = isClass ? classOrInstance : $classOf(classOrInstance),
          typeIdProperty = typeInfo.get(type)
                        || strategy?.getTypeIdProperty?.(type)
                        || DefaultTypeIdProperty,
          id             = value[typeIdProperty];

    if ($isNothing(id)) {
        if ($isNothing(type) || type === AnyObject) {
            throw new TypeError(`The type was not specified and could not be inferred from '${typeIdProperty}'.`);
        }
        return isClass ? Reflect.construct(type, emptyArray) : classOrInstance;
    }

    const desiredType = strategy?.resolveTypeWithId?.(id) || typeId.getType(id);
   
    if ($isNothing(desiredType)) {
        throw new TypeError(`The type with id '${id}' could not be resolved.`);
    }

    if (isClass) {
        return Reflect.construct(desiredType, emptyArray)
    }

    if (!(classOrInstance instanceof desiredType)) {
        throw new TypeError(`Expected instance of type '${desiredType.name}', but received '${type.name}'.`);
    }

    return classOrInstance;
}

function mapKey(target, key, value, composer, format, seen) {
    const type = design.get(target, key)?.propertyType?.type;
    if ($isNothing(type)) {
        target[key] = this.isPrimitiveValue(value) ? value?.valueOf() : value;
    } else if (!$isNothing(value)) {
        target[key] = composer.$mapTo(value, format, type, seen);
    } else if (value === null) {
        target[key] = null;
    }
}
