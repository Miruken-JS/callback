import { $isNothing } from "miruken-core";
import Trampoline from "./trampoline";

/**
 * Container for composition.
 * @class Composition
 * @constructor
 * @param   {Object}  callback  -  callback to compose
 * @extends Trampoline
 */
export class Composition extends Trampoline {
    get canBatch() {
        const callback = this.callback;
        return $isNothing(callback) || callback.canBatch !== false;
    }

    static isComposed(callback, type) {
        return callback instanceof this && callback.callback instanceof type;
    }
}

export default Composition;
