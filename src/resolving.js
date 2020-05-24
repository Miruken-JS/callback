import { 
    $isNothing, $isFunction, createKeyChain
} from "miruken-core";

import Inquiry from "./inquiry";
import { CallbackPolicy } from "./callback-policy";

const _ = createKeyChain();

export const Resolving = Inquiry.extend({
    constructor(key, callback) {
        if ($isNothing(callback)) {
            throw new Error("The callback argument is required.");
        }
        if (callback instanceof Inquiry) {
            this.base(key, true, callback);
        } else {
            this.base(key, true);
        }
        _(this).callback = callback;
    },

    get callback()  { return _(this).callback; },
    get succeeded() { return _(this).succeeded; },

    guardDispatch(handler, binding) {
        const outer = this.base(handler, binding);
        if (outer) {
            const callback = _(this).callback;
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
        if (_(this).succeeded && !greedy) return true;
        const callback = this.callback,
              handled  = CallbackPolicy.dispatch(
                  resolution, callback, greedy, composer);
        if (handled) { _(this).succeeded = true; }    
        return handled;
    },
    toString() {
        return `Resolving | ${this.key} => ${this.callback}`;
    }     
});

export default Resolving;