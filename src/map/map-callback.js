import {
    Base, conformsTo, $isString, $isNothing,
    $isPromise, $classOf, createKeyChain
} from "miruken-core";

import { CallbackControl } from "../callback-control";
import { mapsFrom, mapsTo } from "./maps";

const _ = createKeyChain();

/**
 * Base callback for mapping.
 * @class MapCallback
 * @constructor
 * @param   {Any} ormat  -  format specifier
 * @extends Base
 */
@conformsTo(CallbackControl)
export class MapCallback extends Base {
    constructor(format) {
        if (new.target === MapCallback) {
            throw new Error("MapCallback is abstract and cannot be instantiated.");
        }
        super();
        const _this = _(this);
        _this.format   = format;
        _this.results  = [];
        _this.promises = [];
    }

    get format() { return _(this).format; }
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
 * @param   {Object}  object     -  object to map
 * @param   {Any}     format     -  format specifier
 * @extends MapCallback
 */
export class MapFrom extends MapCallback {
    constructor(object, format) {
        if ($isNothing(object)) {
            throw new TypeError("Missing object to map.");
        }
        super(format);
        _(this).object = object;     
    }

    /**
     * The type of object.
     * @property {Function} type
     */   
    type;

    /**
     * The fields to map.  Object literal or true.
     * @property {Any} fields
     */   
    fields;

    /**
     * Determines how type identifiers are used.
     * @property {Function} typeIdHandling
     */   
    typeIdHandling;

    get object() { return _(this).object; }   
    get callbackPolicy() { return mapsFrom.policy; }
    
    copyOptions(mapFrom) {
        mapFrom.type           = this.type;
        mapFrom.fields         = this.fields;
        mapFrom.typeIdHandling = this.typeIdHandling;
    }

    dispatch(handler, greedy, composer) {
        const target = this.object,
              source = $classOf(target);
        if ($isNothing(source)) return false;
        return mapsFrom.dispatch(handler, this, this, source,
            composer, false, this.addResult.bind(this)); 
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
 * @extends MapCallback
 */
export class MapTo extends MapCallback {
    constructor(value, format, classOrInstance) {
        if ($isNothing(value)) {
            throw new TypeError("Missing value to map.");
        }        
        super(format);
        if ($isNothing(classOrInstance) && !$isString(value)) {
            classOrInstance = $classOf(value);
        }
        const _this = _(this);
        _this.value           = value;
        _this.classOrInstance = classOrInstance;
    }

    /**
     * True if all properties are mapped.
     * @property {Boolean} dynamic
     */   
    dynamic;

    /**
     * True if propery names ignore case.
     * @property {Boolean} ignoreCase
     */  
    ignoreCase;

    get value() { return _(this).value; }                                     
    get classOrInstance() { return _(this).classOrInstance; }
    get callbackPolicy() { return mapsTo.policy; }

    copyOptions(mapTo) {
        mapTo.dynamic    = this.dynamic;
        mapTo.ignoreCase = this.ignoreCase;
    }

    dispatch(handler, greedy, composer) {
        const source = this.classOrInstance || this.value;
        return mapsTo.dispatch(handler, this, this, source,
            composer, false, this.addResult.bind(this));
    }
    toString() {
        return `MapTo | ${String(this.format)} ${this.value}`;
    }

    static dynamic(mapTo) {
        mapTo.dynamic = true;
    } 
}
