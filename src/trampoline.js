import { 
    Base, Undefined, $isFunction,
    conformsTo, createKeyChain
} from "miruken-core";

import { CallbackControl } from "./callback-control";
import { CallbackPolicy, handles } from "./callback-policy";

const _ = createKeyChain();

@conformsTo(CallbackControl)
export class Trampoline extends Base {
    constructor(callback) {
        super();
        if (callback) {
            _(this).callback = callback;
        }
    }
    
    get callback() { return _(this).callback; }    
    get policy() { 
        const callback = this.callback;
        return callback && callback.policy;
    }
    get callbackResult() {
        const callback = this.callback;
        return callback && callback.callbackResult;
    }
    set callbackResult(value) {
        const callback = this.callback;
        if (callback) {
            callback.callbackResult = value;
        }
    }

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

    dispatch(handler, greedy, composer) {
        const callback = this.callback;
        return callback
             ? CallbackPolicy.dispatch(handler, callback, greedy, composer)
             : handles.dispatch(handler, this, this, null, composer, greedy);
    }
}

