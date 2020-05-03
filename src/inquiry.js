import {
    Base, Undefined, Variance,
    $isPromise, $classOf, $isNothing,
    $isSomething, $instant, $flatten
} from "miruken-core";

import {
    DispatchingCallback, Binding, $provide
} from "./policy";

/**
 * Callback representing the covariant resolution of a key.
 * @class Inquiry
 * @constructor
 * @param   {any}      key    -  inquiry key
 * @param   {boolean}  many   -  inquiry cardinality
 * @param   {Inquiry}  parent -  parent inquiry
 * @extends Base
 */
export const Inquiry = Base.extend(DispatchingCallback, {
    constructor(key, many, parent) {
        if ($isNothing(key)) {
            throw new Error("The key is required.");
        }
        
        if ($isSomething(parent)) {
            if (!(parent instanceof Inquiry)) {
                throw new TypeError("The parent is not an Inquiry.");
            }
            this._parent = parent;
        }

        this._key         = key;
        this._many        = !!many;
        this._resolutions = [];
        this._promises    = [];
        this._instant     = $instant.test(key);
    },

    get key() { return this._key; },            
    get isMany() { return this._many; },
    get parent() { return this._parent; },
    get instant() { return this._promises.length == 0; },             
    get resolutions() { return this._resolutions; },
    get callbackPolicy() { return $provide; },       
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

    isSatisfied(resolution, greedy, composer) { return true; },
    resolve(resolution, greedy, composer) {
        let resolved;
        if ($isNothing(resolution)) return false;
        if (Array.isArray(resolution)) {
            resolved = $flatten(resolution, true).reduce(
                (s, r) => include.call(this, r, greedy, composer) || s, false);  
        } else {
            resolved = include.call(this, resolution, greedy, composer);
        }
        if (resolved) {
            this._result = undefined;
        }
        return resolved;
    },
    acceptPromise(promise) {
        return promise.catch(Undefined);
    },
    guardDispatch(handler, binding) {
        if (!inProgress.call(this, handler, binding)) {
            return function (self, h, b) {
                self._handler = handler;
                self._binding = binding;
                return function () {
                    self._handler = h;
                    self._binding = b;
                }
            }(this, this._handler, this._binding);
        }
    },
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
            composer, this.isMany, (r, c) => this.resolve(r, greedy, c))
            || resolved;

        return resolved || (resolutions.length + promises.length > count);
    },
    toString() {
        return `Inquiry ${this.isMany ? "many ": ""}| ${this.key}`;
    }          
});

function include(resolution, greedy, composer) {
    if ($isNothing(resolution)) return false;
    if ($isPromise(resolution)) {
        if (this._instant) return false;
        const promise = this.acceptPromise(resolution.then(res => {
            if (Array.isArray(res)) {
                const satisfied = res
                    .filter(r => r && this.isSatisfied(r, greedy, composer));
                this._resolutions.push(...satisfied);
            } else if (res && this.isSatisfied(res, greedy, composer)) {
                this._resolutions.push(res);
            }
        }));
        if (promise != null) {
            this._promises.push(promise);
        }
    } else if (!this.isSatisfied(resolution, greedy, composer)) {
        return false;
    } else {
        this._resolutions.push(resolution);
    }
    return true;                             
}

function inProgress(handler, binding)
{
    return this._handler === handler &&
           this._binding === binding ||
           (this.parent && this.parent.inProgress(handler, binding));
}

export default Inquiry;