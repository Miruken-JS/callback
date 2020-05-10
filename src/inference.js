import { $isNothing, $isFunction } from "miruken-core";
import Trampoline from "./trampoline";

export const Inference = Trampoline.extend({
    constructor(callback) {
        if ($isNothing(callback)) {
            throw new Error("The callback argument is required.");
        }
        this.base(callback);
    },

    inferCallback() { return this; },
    dispatch(handler, greedy, composer) {
        const handled = this.base(handler, greedy, composer);
        if (handled) return true;

        return false;
    }
}, {
    get(callback) {
        return callback && $isFunction(callback.inferCallback)
             ? callback.inferCallback()
             : new Inference(callback);
    }
});

export default Inference;