import {
    Base, $isPromise, $isNothing, createKeyChain
} from "miruken-core";

import { CallbackControl, $handle } from "./policy";

const _ = createKeyChain();

/**
 * Callback representing a command with results.
 * @class Command
 * @constructor
 * @param   {Object}   callback  -  callback
 * @param   {boolean}  many      -  command cardinality
 * @extends Base
 */
export const Command = Base.extend(CallbackControl, {
    constructor(callback, many) {
        if ($isNothing(callback)) {
            throw new TypeError("The callback is required.");
        }
        const _this = _(this);
        _this.callback = callback;
        _this.many     = !!many;
        _this.results  = [];
        _this.promises = [];
    },
    
    get isMany()   { return _(this).many; },
    get callback() { return _(this).callback; },
    get results()  { return _(this).results; }, 
    get callbackPolicy()   { return $handle; },
    get canBatch() {
        return this.callback.canBatch !== false;
    },           
    get callbackResult() {
        const { result, results, promises} = _(this);
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
    },
    set callbackResult(value) { _(this).result = value; },

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
    },            
    dispatch(handler, greedy, composer) {
        const count = _(this).results.length;
        return $handle.dispatch(handler, this.callback, null,
            composer, this.isMany, this.respond.bind(this)) || 
            _(this).results.length > count;     
    },        
    toString() {
        return `Command ${this.isMany ? "many ": ""}| ${this.callback}`;
    }  
});

export default Command;