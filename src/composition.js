import { Trampoline } from "./trampoline";

/**
 * Container for composition.
 * @class Composition
 * @constructor
 * @param   {Object}  callback  -  callback to compose
 * @extends Trampoline
 */
export const Composition = Trampoline.extend(null, {
    isComposed(callback, type) {
        return callback instanceof this && callback.callback instanceof type;
    }
});

export default Composition;
