import {
    Base, Undefined, $isPromise,
    $isNothing, $instant, $flatten
} from "miruken-core";

import { CallbackControl, $lookup } from "./policy";

/**
 * Callback representing the invariant lookup of a key.
 * @class Lookup
 * @constructor
 * @param   {Any}      key   -  lookup key
 * @param   {boolean}  many  -  lookup cardinality
 * @extends Base
 */
export const Lookup = Base.extend(CallbackControl, {
    constructor(key, many) {
        if ($isNothing(key)) {
            throw new Error("The key is required.");
        }
        this._key      = key;
        this._many     = !!many;
        this._results  = [];
        this._promises = [];
        this._instant  = $instant.test(key);
    },

    get key() { return this._key; },
    get isMany() { return this._many; },
    get instant() { return this._promises.length == 0; },
    get results() { return this._results; },
    get callbackPolicy() { return $lookup; },     
    get callbackResult() {
        if (this._result === undefined) {
            const results = this._results;
            if (this.instant) {
                this._result = this.isMany ? results : results[0];
            } else {
                this._result = this.isMany 
                    ? Promise.all(this._promises).then(() => results)
                    : Promise.all(this._promises).then(() => results[0]);
            }
        }
        return this._result;
    },
    set callbackResult(value) { this._result = value; },
    
    addResult(result, composer) {
        let found;
        if ($isNothing(result)) return false;
        if (Array.isArray(result)) {
            found = $flatten(result, true).reduce(
                (s, r) => include.call(this, r, composer) || s, false);  
        } else {
            found = include.call(this, result, composer);
        }
        if (found) {
            this._result = undefined;
        }
        return found;
    },               
    dispatch(handler, greedy, composer) {
        const results  = this._results,
              promises = this._promises,
              count    = results.length + promises.length,
              found    = $lookup.dispatch(handler, this, this.key,
                composer, this.isMany, this.addResult.bind(this));
        return found || (results.length + promises.length > count);
    },
    toString() {
        return `Lookup ${this.isMany ? "many ": ""}| ${this.key}`;
    }            
});

function include(result, composer) {
    if ($isNothing(result)) return false;
    if ($isPromise(result)) {
        if (this._instant) return false;
        this._promises.push(result.then(res => {
            if (Array.isArray(res)) {
                this._results.push(...res.filter(r => r != null));
            } else if (res != null) {
                this._results.push(res);
            }
        }).catch(Undefined));
    } else {
        this._results.push(result);
    }
    return true;                             
}

export default Lookup;