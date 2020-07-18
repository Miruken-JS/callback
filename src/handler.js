import {
    Base, $isNothing, $isFunction, $decorator
} from "miruken-core";

import { Composition } from "./composition";
import { CallbackPolicy } from "./callback-policy";

export let $composer;

/**
 * Base class for handling arbitrary callbacks.
 * @class Handler
 * @constructor
 * @param  {Object}  [delegate]  -  delegate
 * @extends Base
 */
export class Handler extends Base {
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
    }
    
    /**
     * Handles the callback with all arguments populated.
     * @method handleCallback
     * @param   {Object}   callback    -  any callback
     * @param   {boolean}  greedy      -  true if handle greedily
     * @param   {Handler}  [composer]  -  composition handler
     * @returns {boolean} true if the callback was handled, false otherwise.
     */
    handleCallback(callback, greedy, composer) {
        return CallbackPolicy.dispatch(this, callback, greedy, composer);
    }

    static for(object) { 
        return object instanceof Handler ? object : new HandlerAdapter(object);
    }
}

export class HandlerAdapter extends Handler {
    constructor(handler) {
        if ($isNothing(handler)) {
            throw new TypeError("No handler specified.");
        }
        super();
        Object.defineProperty(this, "handler", {
            configurable: false,
            value:        handler
        });
    }

    handleCallback(callback, greedy, composer) {
        return CallbackPolicy.dispatch(this.handler, callback, greedy, composer);
    }
}

const compositionScope = $decorator({
    handleCallback(callback, greedy, composer) {
        if (callback.constructor !== Composition) {
            callback = new Composition(callback);
        }
        return this.base(callback, greedy, composer);
    }
});

Handler.implement({
    /**
     * Runs `block` with this Handler as the abmient **$composer**.
     * @method compose
     * @param  {Function}  block       -  block
     * @param  {Object}    [receiver]  -  reciever
     * @returns {Any} the return value of the block.
     * @for Handler
     */    
    $compose(block, receiver) {
        if (!$isFunction(block)) {
            throw new TypeError(`Invalid block: ${block} is not a function.`);
        }
        const oldComposer = $composer;                    
        try {
            $composer = this;
            return block.call(receiver);
        } finally {
            $composer = oldComposer;
        }
    }
});

