import {
    Base, conformsTo, $isNothing,
    $isObject, $isString, $isPromise,
    $classOf, createKeyChain
} from "miruken-core";

import { CallbackControl } from "../callback-control";
import { mapsFrom, mapsTo } from "./maps";
import { AnyObject } from "./any-object";

const _ = createKeyChain();

/**
 * Base callback for mapping.
 * @class MapCallback
 * @constructor
 * @param   {Any}   format  -  format specifier
 * @param   {Array} seen    -  array of seen objects
 * @extends Base
 */
@conformsTo(CallbackControl)
export class MapCallback extends Base {
    constructor(format, seen) {
        if (new.target === MapCallback) {
            throw new Error("MapCallback is abstract and cannot be instantiated.");
        }
        super();
        const _this = _(this);
        _this.format   = format;
        _this.results  = [];
        _this.promises = [];
        _this.seen     = seen || [];
    }

    get format() { return _(this).format; }
    get seen() { return _(this).seen; }

    get callbackResult() {
        if (_(this).result === undefined) {
            const { results, promises }  = _(this);
            _(this).result = promises.length == 0 
                ? results[0]
                : Promise.all(promises).then(() => results[0]);
        }
        return _(this).result;
    }
    set callbackResult(value) { _(this).result = value; }

    addResult(result) {
        if ($isNothing(result)) return;
        if ($isPromise(result)) {
            _(this).promises.push(result.then(res => {
                if (res != null) {
                    _(this).results.push(res);
                }
            }));
        } else {
            _(this).results.push(result);
        }
        _(this).result = undefined;
    }
}

/**
 * Callback to map an `object` to `format`.
 * @class MapFrom
 * @constructor
 * @param   {Object}  object  -  object to map
 * @param   {Any}     format  -  format specifier
 * @param   {Array}   seen    -  array of seen objects
 * @extends MapCallback
 */
export class MapFrom extends MapCallback {
    constructor(object, format, seen) {
        if ($isNothing(object)) {
            throw new TypeError("Missing object to map.");
        }
        if (checkCircularity(object, seen)) {
            throw new Error(`Circularity detected: MapFrom ${object} in progress.`);
        }
        super(format, seen);
        _(this).object = object;     
    }

    get object() { return _(this).object; }   
    get callbackPolicy() { return mapsFrom.policy; }

    dispatch(handler, greedy, composer) {
        const object = this.object,
              source = $classOf(object);
        if ($isNothing(source)) return false;
        const results = _(this).results,
              count   = results.length;
        return mapsFrom.dispatch(handler, this, this, source,
            composer, false, this.addResult.bind(this)) ||
                results.length > count; 
    }

    toString() {
        return `MapFrom | ${this.object} to ${String(this.format)}`;
    }       
}

/**
 * Callback to map a formatted `value` into an object.
 * @class MapTo
 * @constructor
 * @param   {Any}              value            -  formatted value
 * @param   {Any}              format           -  format specifier
 * @param   {Function|Object}  classOrInstance  -  instance or class to unmap
 * @param   {Array}            seen             -  array of seen objects
 * @extends MapCallback
 */
export class MapTo extends MapCallback {
    constructor(value, format, classOrInstance, seen) {
        if ($isNothing(value)) {
            throw new TypeError("Missing value to map.");
        }     
        if (checkCircularity(value, seen)) {
            throw new Error(`Circularity detected: MapTo ${value} in progress.`);
        }   
        super(format, seen);
        if ($isNothing(classOrInstance) && !$isString(value)) {
            classOrInstance = $classOf(value);
            if (classOrInstance === Object) {
                classOrInstance = AnyObject;
            }
        }
        const _this = _(this);
        _this.value           = value;
        _this.classOrInstance = classOrInstance;
    }

    get value() { return _(this).value; }                                     
    get classOrInstance() { return _(this).classOrInstance; }
    get callbackPolicy() { return mapsTo.policy; }

    dispatch(handler, greedy, composer) {
        const results = _(this).results,
              count   = results.length,
              source  = this.classOrInstance || this.value;
        return mapsTo.dispatch(handler, this, this, source,
            composer, false, this.addResult.bind(this)) || 
                results.length > count;
    }

    toString() {
        return `MapTo | ${String(this.format)} ${this.value}`;
    }
}

function checkCircularity(object, seen) {
    return $isObject(object) && seen?.includes(object);
}
