import { $isNothing } from "miruken-core";
import Trampoline from "./trampoline";
import Inference from "./inference"

/**
 * Container for composition.
 * @class Composition
 * @constructor
 * @param   {Object}  callback  -  callback to compose
 * @extends Trampoline
 */
export const Composition = Trampoline.extend({
    inferCallback() {
        const callback = this.callback;
        if ($isNothing(callback)) return this;
        const infer = Inference.get(callback);
        return infer === callback ? this : new Composition(infer);
    }
}, {
    isComposed(callback, type) {
        return callback instanceof this && callback.callback instanceof type;
    }
});

export default Composition;
