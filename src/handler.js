import {
    Base, Variance, $isNothing, $isFunction,
    $isPromise, $flatten, $decorator
} from "miruken-core";

import { $handle, } from "./policy";
import { DispatchingCallback, $unhandled } from "./callback";
import { RejectedError, TimeoutError } from "./errors"; 

/**
 * Marks a callback as composed.
 * @class Composition
 * @constructor
 * @param   {Object}   callback  -  callback to compose
 * @param   {Boolean}  greedy    -  true if handle greedily
 * @extends Base
 */
export const Composition = Base.extend(DispatchingCallback, {
    constructor(callback, greedy) {
        if (callback) {
            this.extend({
                /**
                 * Gets the callback.
                 * @property {Object} callback
                 * @readOnly
                 */
                get callback() { return callback; },
                /**
                 * Gets the greedy flag.
                 * @property {Boolean} greedy
                 * @readOnly
                 */
                get greedy() { return greedy; },
                /**
                 * Gets the policy.
                 * @property {Function} policy
                 * @readOnly
                 */         
                get policy() { return callback.policy; },             
                /**
                 * Gets/sets the effective callback result.
                 * @property {Any} callback result
                 */                
                get callbackResult() {
                    return callback.callbackResult;
                },
                set callbackResult(value) {
                    callback.callbackResult = value;
                },
                dispatch(handler, greedy, composer) {
                    return Handler.dispatch(handler, callback, this.greedy, composer);
                }
            });
        }
    }
}, {
    isComposed(callback, type) {
        return callback instanceof this && callback.callback instanceof type;
    }
});

/**
 * Base class for handling arbitrary callbacks.
 * @class Handler
 * @constructor
 * @param  {Object}  [delegate]  -  delegate
 * @extends Base
 */
export const Handler = Base.extend({
    /**
     * Handles the callback.
     * @method handle
     * @param   {Object}  callback        -  any callback
     * @param   {boolean} [greedy=false]  -  true if handle greedily
     * @param   {Handler} [composer]      -  composition handler
     * @returns {boolean} true if the callback was handled, false otherwise.
     */
    handle(callback, greedy, composer) {
        if ($isNothing(callback)) {
            return false;
        }
        if ($isNothing(composer)) {
            composer = compositionScope(this);
        }
        return !!this.handleCallback(callback, !!greedy, composer);
    },
    /**
     * Handles the callback with all arguments populated.
     * @method handleCallback
     * @param   {Object}   callback    -  any callback
     * @param   {boolean}  greedy      -  true if handle greedily
     * @param   {Handler}  [composer]  -  composition handler
     * @returns {boolean} true if the callback was handled, false otherwise.
     */
    handleCallback(callback, greedy, composer) {
        return Handler.dispatch(this, callback, greedy, composer);
    }
}, {
    dispatch(handler, callback, greedy, composer) {
        if ($isFunction(callback.dispatch)) {
            return callback.dispatch(handler, greedy, composer);
        }
        return $handle.dispatch(handler, callback, null, composer, greedy) !== $unhandled;       
    },
    coerce(object) { return new this(object); }
});

export const HandlerAdapter = Handler.extend({
    constructor(handler) {
        if ($isNothing(handler)) {
            throw new TypeError("No handler specified.");
        }
        Object.defineProperty(this, "handler", {
            configurable: false,
            value:        handler
        });
    },
    handleCallback(callback, greedy, composer) {
        return Handler.dispatch(this.handler, callback, greedy, composer);
    }
});

Base.implement({
    toHandler() {
         return this instanceof Handler ? this : new HandlerAdapter(this);
    }
});

const compositionScope = $decorator({
    handleCallback(callback, greedy, composer) {
        if (callback.constructor !== Composition) {
            callback = new Composition(callback, greedy);
        }
        return this.base(callback, greedy, composer);
    }
});

export default Handler;
