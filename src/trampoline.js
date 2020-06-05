import { 
    Base, $isFunction, createKeyChain
} from "miruken-core";

import CallbackControl from "./callback-control";
import { CallbackPolicy, handles } from "./callback-policy";

const _ = createKeyChain();

export const Trampoline = Base.extend(CallbackControl, {
    constructor(callback) {
        if (callback) {
            _(this).callback = callback;
        }
    },
    
    get callback() { return _(this).callback; },       
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
        if (callback) {
            const guardDispatch = callback.guardDispatch;
            if ($isFunction(guardDispatch)) {
                guardDispatch.call(callback, handler, binding);
            }
        }        
    },
    dispatch(handler, greedy, composer) {
        const callback = this.callback;
        return callback
             ? CallbackPolicy.dispatch(handler, callback, greedy, composer)
             : handles.dispatch(handler, this, null, composer, greedy);
    }
});

export default Trampoline;