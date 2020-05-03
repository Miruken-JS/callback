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
        const infer = Inference.get(this.callback);
        return infer === this.callback ? this
             : new Composition(infer);
    }
}, {
    isComposed(callback, type) {
        return callback instanceof this && callback.callback instanceof type;
    }
});

export default Composition;
