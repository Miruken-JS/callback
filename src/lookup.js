import {
    Base, Undefined, conformsTo,
    $isPromise, $isNothing, $instant,
    $flatten, createKeyChain
} from "miruken-core";

import CallbackControl from "./callback-control";
import { looksup } from "./callback-policy";

const _ = createKeyChain();

/**
 * Callback representing the invariant lookup of a key.
 * @class Lookup
 * @constructor
 * @param   {Any}      key   -  lookup key
 * @param   {boolean}  many  -  lookup cardinality
 * @extends Base
 */
@conformsTo(CallbackControl)
export class Lookup extends Base {
    constructor(key, many) {
        if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }

        super();
        const _this = _(this);
        _this.key      = key;
        _this.many     = !!many;
        _this.results  = [];
        _this.promises = [];
        _this.instant  = $instant.test(key);
    }

    get key()            { return _(this).key; }
    get isMany()         { return _(this).many; }
    get results()        { return _(this).results; }
    get callbackPolicy() { return lookups.policy; }     
    get callbackResult() {
        if (_(this).result === undefined) {
            const results  = this.results,
                  promises = _(this).promises;;
            if (promises.length == 0) {
                _(this).result = this.isMany ? results : results[0];
            } else {
                _(this).result = this.isMany 
                    ? Promise.all(promises).then(() => results)
                    : Promise.all(promises).then(() => results[0]);
            }
        }
        return _(this).result;
    }
    set callbackResult(value) { _(this).result = value; }
    
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
            delete _(this).result;
        }
        return found;
    }

    dispatch(handler, greedy, composer) {
        const results  = this.results,
              promises = _(this).promises,
              count    = results.length + promises.length,
              found    = looksup.dispatch(handler, this, this, this.key,
                composer, this.isMany, this.addResult.bind(this));
        return found || (results.length + promises.length > count);
    }

    toString() {
        return `Lookup ${this.isMany ? "many ": ""}| ${this.key}`;
    }            
}

function include(result, composer) {
    if ($isNothing(result)) return false;
    if ($isPromise(result)) {
        if (_(this).instant) return false;
        const results = this.results;
        _(this).promises.push(result.then(res => {
            if (Array.isArray(res)) {
                results.push(...res.filter(r => r != null));
            } else if (res != null) {
                results.push(res);
            }
        }).catch(Undefined));
    } else {
        _(this).results.push(result);
    }
    return true;                             
}

export default Lookup;