import { Base, $isFunction } from "miruken-core";

import {
    CallbackControl, $handle, $policy
} from "./policy";

export const Trampoline = Base.extend(CallbackControl, {
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

    guardDispatch(handler, binding) {
        const callback = this.callback;
        if (callback && $isFunction(callback.guardDispatch)) {
            callback.guardDispatch(handler, binding);
        }        
    },
    completeCallback() {
        const callback = this.callback;
        if (callback && $isFunction(callback.completeCallback)) {
            callback.completeCallback();
        }
    },
    dispatch(handler, greedy, composer) {
        const callback = this.callback;
        return callback
             ? $policy.dispatch(handler, callback, greedy, composer)
             : $handle.dispatch(handler, this, null, composer, greedy);
    }
});

export default Trampoline;