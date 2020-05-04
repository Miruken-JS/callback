import { $isNothing, $isFunction } from "miruken-core";
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

    get callback() { return this._callback; },
    get succeeded() { return this._succeeded; },
    get successfulCallbackResult() { return this._successfulCallbackResult; },

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
        if (this._succeeded && !greedy) return true;
        const callback = this.callback,
              handled  = $policy.dispatch(resolution, callback, greedy, composer);
        if (handled) {
            if ("callbackResult" in callback) {
                this._successfulCallbackResult = callback.callbackResult;
            }
            this._succeeded = true;
        }    
        return handled;
    },
    toString() {
        return `Resolving | ${this.key} => ${this.callback}`;
    }     
});

export default Resolving;