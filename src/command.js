import {
    Base, Undefined, $isNothing, $isFunction,
    $isPromise, conformsTo, createKeyChain
} from "miruken-core";

import { CallbackControl } from "./callback-control";
import { handles } from "./callback-policy";

const _ = createKeyChain();

/**
 * Callback representing a command with results.
 * @class Command
 * @constructor
 * @param   {Object}   callback  -  callback
 * @param   {boolean}  many      -  command cardinality
 * @extends Base
 */
@conformsTo(CallbackControl)
export class Command extends Base {
    constructor(callback, many) {
        if ($isNothing(callback)) {
            throw new TypeError("The callback argument is required.");
        }
        super();
        const _this = _(this);
        _this.callback = callback;
        _this.many     = !!many;
        _this.results  = [];
        _this.promises = [];
    }
    
    get isMany()         { return _(this).many; }
    get callback()       { return _(this).callback; }
    get results()        { return _(this).results; } 
    get callbackPolicy() { return handles.policy; }
    get canBatch() {
        return this.callback.canBatch !== false;
    }
    get canFilter() {
        return this.callback.canFilter !== false;
    }
    get canInfer() {
        return this.callback.canInfer !== false;
    }
    get callbackResult() {
        let { result, results, promises} = _(this);
        if (result === undefined) {
            if (promises.length == 0) {
                _(this).result = result = this.isMany ? results : results[0];
            } else {
                _(this).result = result = this.isMany
                    ? Promise.all(promises).then(() => results)
                    : Promise.all(promises).then(() => results[0]);
            }
        }
        return result;
    }
    set callbackResult(value) { _(this).result = value; }

    guardDispatch(handler, binding) {
        const callback = this.callback;
        if (callback) {
            const guardDispatch = callback.guardDispatch;
            if ($isFunction(guardDispatch)) {
                return guardDispatch.call(callback, handler, binding);
            }
        }
        return Undefined;
    }

    respond(response) {
        if ($isNothing(response)) return;
        if ($isPromise(response)) {
            _(this).promises.push(response.then(res => {
                if (res != null) {
                    _(this).results.push(res);
                }
            }));
        } else {
            _(this).results.push(response);
        }
        delete _(this).result;
    }

    dispatch(handler, greedy, composer) {
        const count = _(this).results.length;
        return handles.dispatch(handler, this.callback, this, null,
            composer, this.isMany, this.respond.bind(this)) || 
            _(this).results.length > count;     
    }

    toString() {
        return `Command ${this.isMany ? "many ": ""}| ${this.callback}`;
    }  
}
