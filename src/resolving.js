import {
    $isNothing, $isFunction, $isPromise
} from "miruken-core";

import { $policy } from "./policy"
import Inquiry from "./inquiry";
import { NotHandledError } from "./errors";

export const Resolving = Inquiry.extend({
    constructor(key, callback) {
        if ($isNothing(callback)) {
            throw new Error("The callback is required.");
        }
        if (callback instanceof Inquiry) {
            this.base(key, true, callback);
        } else {
            this.base(key, true);
        }
        this._callback = callback;
    },

    get callback() { return this._callback },
    inferCallback() { return this; },
    guardDispatch(handler, binding) {
        const outer = this.base(handler, binding);
        if (outer) {
            const callback = this._callback;
            if ($isFunction(callback.guardDispatch)) {
                const inner = callback.guardDispatch(handler, binding);
                if (!inner) {
                    if ($isFunction(outer)) {
                        outer.call(this);
                    }
                    return inner;
                }
                if ($isFunction(inner)) {
                    if ($isFunction(outer)) {
                        return function () {
                            inner.call(callback);
                            outer.call(this);
                        }
                    }
                    return inner;
                }
            }
        }
        return outer;
    },
    isSatisfied(resolution, greedy, composer) { 
        if (this._handled && !greedy) return true;
        const callback = this.callback,
              handled  = $policy.dispatch(resolution, callback, greedy, composer);
        if (handled) {
            if ($isNothing(this._innerResult) && "callbackResult" in callback) {
                this._innerResult = callback.callbackResult;
            }
            this._handled = true;
        }    
        return handled;
    },
    dispatch(handler, greedy, composer) {
        const handled  = this.base(handler, greedy, composer),
              callback = this.callback;
        if ("callbackResult" in callback) {
            const outerResult = this.callbackResult;
            if ($isPromise(outerResult)) {
                callback.callbackResult = outerResult.then(() => {
                    if (this._handled) {
                        return this._innerResult
                    }
                    throw new NotHandledError(callback);
                });
            }
        }   
        return handled;
    },    
    toString() {
        return `Resolving | ${this.key} => ${this.callback}`;
    }     
});

export default Resolving;