import {
    Base, Undefined, Variance,
    conformsTo, $isPromise, $classOf,
    $isNothing, $isSomething, $instant,
    $flatten, createKeyChain
} from "miruken-core";

import { CallbackControl } from "./callback-control";
import { Binding } from "./binding/binding";
import { BindingScope } from "./binding/binding-scope";
import { BindingMetadata } from "./binding/binding-metadata";
import { provides } from "./callback-policy";

const _ = createKeyChain();

/**
 * Callback representing the covariant resolution of a key.
 * @class Inquiry
 * @constructor
 * @param   {any}      key    -  inquiry key
 * @param   {boolean}  many   -  inquiry cardinality
 * @param   {Inquiry}  parent -  parent inquiry
 * @extends Base
 */
@conformsTo(CallbackControl, BindingScope)
export class Inquiry extends Base {
    constructor(key, many, parent) {
        if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }
        
        super();
        const _this = _(this);

        if ($isSomething(parent)) {
            if (!(parent instanceof Inquiry)) {
                throw new TypeError("The parent is not an Inquiry.");
            }
            _this.parent = parent;
        }

        _this.key         = key;
        _this.many        = !!many;
        _this.resolutions = [];
        _this.promises    = [];
        _this.instant     = $instant.test(key);
        _this.metadata    = new BindingMetadata();
    }

    get key()            { return _(this).key; }   
    get isMany()         { return _(this).many; }
    get parent()         { return _(this).parent; }
    get handler()        { return _(this).handler; }
    get binding()        { return _(this).binding; }
    get metadata()       { return _(this).metadata; }    
    get resolutions()    { return _(this).resolutions; }
    get callbackPolicy() { return provides.policy; }    
    get callbackResult() {
        if (_(this).result === undefined) {
            const resolutions = this.resolutions,
                  promises    = _(this).promises;
            if (promises.length == 0) {
                _(this).result = this.isMany ? resolutions : resolutions[0];
            } else {
                _(this).result = this.isMany 
                    ? Promise.all(promises).then(() => resolutions)
                    : Promise.all(promises).then(() => resolutions[0]);
            }
        }
        return _(this).result;
    }
    set callbackResult(value) { _(this).result = value; }

    isSatisfied(resolution, greedy, composer) { return true; }

    resolve(resolution, strict, greedy, composer) {
        let resolved;
        if ($isNothing(resolution)) return false;
        if (!strict && Array.isArray(resolution)) {
            resolved = $flatten(resolution, true).reduce(
                (s, r) => include.call(this, r, false, greedy, composer) || s, false);  
        } else {
            resolved = include.call(this, resolution, strict, greedy, composer);
        }
        if (resolved) {
            _(this).result = undefined;
        }
        return resolved;
    }

    acceptPromise(promise) {
        return promise.catch(Undefined);
    }

    guardDispatch(handler, binding) {
        if (!this.inProgress(handler, binding)) {
            return function (self, h, b) {
                _(self).handler = handler;
                _(self).binding = binding;
                return function () {
                    _(self).handler = h;
                    _(self).binding = b;
                }
            }(this, _(this).handler, _(this).binding);
        }
    }

    inProgress(handler, binding) {
        return _(this).handler === handler &&
            _(this).binding === binding ||
            (this.parent && this.parent.inProgress(handler, binding));
    }

    dispatch(handler, greedy, composer) {
        if (_(this).metadata.isEmpty) {
            // check if handler implicitly satisfies key
            const implied = Binding.create(this.key);
            if (implied.match($classOf(handler), Variance.Contravariant)) {
                resolved = this.resolve(handler, false, greedy, composer);
                if (resolved && !greedy) return true;
            }
        }
        const resolutions = this.resolutions,
              promises    = _(this).promises,
              count       = resolutions.length + promises.length;

        let   resolved = provides.dispatch(handler, this, this, this.key,
            composer, this.isMany, (r, s, c) => this.resolve(r, s, greedy, c))
            || resolved;

        return resolved || (resolutions.length + promises.length > count);
    }

    toString() {
        return `Inquiry ${this.isMany ? "many ": ""}| ${this.key}`;
    }          
}

function include(resolution, strict, greedy, composer) {
    if ($isNothing(resolution)) return false;
    if ($isPromise(resolution)) {
        if (_(this).instant) return false;
        const resolutions = this.resolutions,
              promise     = this.acceptPromise(resolution.then(res => {
            if (Array.isArray(res)) {
                const satisfied = res
                    .filter(r => r && this.isSatisfied(r, greedy, composer));
                resolutions.push(...satisfied);
            } else if (res && this.isSatisfied(res, greedy, composer)) {
                resolutions.push(res);
            }
        }));
        if (promise != null) {
            _(this).promises.push(promise);
        }
    } else if (!this.isSatisfied(resolution, greedy, composer)) {
        return false;
    } else if (strict) {
        this.resolutions.push(resolution);
    } else if (Array.isArray(resolution)) {
        const satisfied = res
            .filter(r => r && this.isSatisfied(r, greedy, composer));
        resolutions.push(...satisfied);
    } else {
        this.resolutions.push(resolution);
    }
    return true;                             
}
