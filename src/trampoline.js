import { Base } from "miruken-core";
import { DispatchingCallback } from "./callback";
import { $handle, $policy } from "./policy";

export const Trampoline = Base.extend(DispatchingCallback, {
    constructor(callback) {
        if (callback) {
            this._callback = callback;
        }
    },
    get callback() { return this._callback; },       
    get policy() { 
        const callback = this.callback;
        return callback && callback.policy;
    },            
    get callbackResult() {
        const callback = this.callback;
        return callback && callback.callbackResult;
    },
    set callbackResult(value) {
        const callback = this.callback;
        if (callback) {
            callback.callbackResult = value;
        }
    },
    dispatch(handler, greedy, composer) {
        const callback = this.callback;
        return callback
             ? $policy.dispatch(handler, callback, greedy, composer)
             : $handle.dispatch(handler, this, null, composer, greedy);
    }
});