import {
    Base, $isPromise, $isNothing
} from "miruken-core";

import { DispatchingCallback, $handle } from "./policy";

/**
 * Callback representing a command with results.
 * @class Command
 * @constructor
 * @param   {Object}   callback  -  callback
 * @param   {boolean}  many      -  command cardinality
 * @extends Base
 */
export const Command = Base.extend(DispatchingCallback, {
    constructor(callback, many) {
        if ($isNothing(callback)) {
            throw new TypeError("The callback is required.");
        }
        this._callback = callback;
        this._many     = !!many;
        this._results  = [];
        this._promises = [];
    },
    
    get isMany()   { return this._many; },
    get callback() { return this._callback; },
    get results()  { return this._results; },    
    get callbackPolicy()   { return $handle; },              
    get callbackResult() {
        if (this._result === undefined) {
            const results  = this._results,
                  promises = this._promises;
            if (promises.length == 0) {
                this._result = this.isMany ? results : results[0];
            } else {
                this._result = this.isMany
                        ? Promise.all(promises).then(() => results)
                        : Promise.all(promises).then(() => results[0]);
            }
        }
        return this._result;
    },
    set callbackResult(value) { this._result = value; },

    respond(response) {
        if ($isNothing(response)) return;
        if ($isPromise(response)) {
            this._promises.push(response.then(res => {
                if (res != null) {
                    this._results.push(res);
                }
            }));
        } else {
            this._results.push(response);
        }
        this._result = undefined;
    },            
    dispatch(handler, greedy, composer) {
        var count = this._results.length;
        return $handle.dispatch(handler, this.callback, null,
            composer, this.isMany, this.respond.bind(this)) || 
            this._results.length > count;     
    },        
    toString() {
        return `Command ${this.isMany ? "many ": ""}| ${this.callback}`;
    }  
});

export default Command;