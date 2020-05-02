import {
    Base, Undefined, Variance,
    $isPromise, $classOf,$isNothing,
    $instant, $flatten
} from "miruken-core";

import { Binding, $provide } from "./policy";
import { DispatchingCallback, $unhandled } from "./callback";

/**
 * Callback representing the covariant resolution of a key.
 * @class Resolution
 * @constructor
 * @param   {any}      key   -  resolution key
 * @param   {boolean}  many  -  resolution cardinality
 * @extends Base
 */
export const Resolution = Base.extend(DispatchingCallback, {
    constructor(key, many) {
        if ($isNothing(key)) {
            throw new Error("The key is required.");
        }
        this._key         = key;
        this._many        = !!many;
        this._resolutions = [];
        this._promises    = [];
        this._instant     = $instant.test(key);
    },

    get key() { return this._key; },            
    get isMany() { return this._many; },
    get instant() { return this._promises.length == 0; },             
    get resolutions() { return this._resolutions; },
    get policy() { return $provide; },       
    get callbackResult() {
        if (this._result === undefined) {
            const resolutions = this._resolutions;
            if (this.instant) {
                this._result = this.isMany ? resolutions : resolutions[0];
            } else {
                this._result = this.isMany 
                    ? Promise.all(this._promises).then(() => resolutions)
                    : Promise.all(this._promises).then(() => resolutions[0]);
            }
        }
        return this._result;
    },
    set callbackResult(value) { this._result = value; },

    isSatisfied(resolution, composer) { return true; },
    resolve(resolution, composer) {
        let resolved;
        if (resolution == null) return false;
        if (Array.isArray(resolution)) {
            resolved = $flatten(resolution, true).reduce(
                (s, r) => include.call(this, r, composer) || s, false);  
        } else {
            resolved = include.call(this, resolution, composer);
        }
        if (resolved) {
            this._result = undefined;
        }
        return resolved;
    },
    acceptPromise(promise) { return promise.catch(Undefined); },   
    dispatch(handler, greedy, composer) {
        // check if handler implicitly satisfies key
        const implied  = new Binding(this.key);
        if (implied.match($classOf(handler), Variance.Contravariant)) {
            resolved = this.resolve(handler, composer);
            if (resolved && !greedy) return true;
        }
        const resolutions = this._resolutions,
              promises    = this._promises,
              count       = resolutions.length + promises.length;

        let   resolved = $provide.dispatch(handler, this, this.key,
            composer, this.isMany, this.resolve.bind(this)) !== $unhandled 
            || resolved;

        return resolved || (resolutions.length + promises.length > count);
    },
    toString() {
        return `Resolution ${this.isMany ? "many ": ""}| ${this.key}`;
    }          
});

function include(resolution, composer) {
    if (resolution == null) return false;
    if ($isPromise(resolution)) {
        if (this._instant) return false;
        const promise = this.acceptPromise(resolution.then(res => {
            if (Array.isArray(res)) {
                const satisfied = res
                    .filter(r => r && this.isSatisfied(r, composer));
                this._resolutions.push(...satisfied);
            } else if (res && this.isSatisfied(res, composer)) {
                this._resolutions.push(res);
            }
        }));
        if (promise != null) {
            this._promises.push(promise);
        }
    } else if (!this.isSatisfied(resolution, composer)) {
        return false;
    } else {
        this._resolutions.push(resolution);
    }
    return true;                             
}

export default Resolution;