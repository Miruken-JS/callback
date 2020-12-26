import {
    Protocol, createKeyChain,
    conformsTo, $isPromise, $flatten
} from "miruken-core";

import { Trampoline } from "./trampoline";
import { CompositeHandler } from "./composite-handler";
import { provides } from "./callback-policy";

const _ = createKeyChain();

/**
 * Protocol to participate in batched operations.
 * @class Batching
 * @extends Protocol
 */
export const Batching = Protocol.extend({
    /**
     * Completes the batching operation.
     * @method complete
     * @param   {Handler}  composer  - composition handler
     * @returns {Any} the batching result.
     */                
    complete(composer) {}
});

/**
 * Coordinates batching operations through the protocol
 * {{#crossLink "Batching"}}{{/crossLink}}.
 * @class BatchingComplete
 * @uses Batching
 */
export const BatchingComplete = Batching.extend();

@conformsTo(BatchingComplete)
export class Batch extends CompositeHandler {
    constructor(...tags) {
        super();
        _(this).tags = $flatten(tags, true);
    }

    shouldBatch(tag) {
        const tags = _(this).tags;
        return tag && (tags.length == 0 || tags.indexOf(tag) >= 0); 
    }

    complete(composer) {
        const results = this.getHandlers().reduce((res, handler) => {
            const result = Batching(handler).complete(composer);
            return result ? [...res, result] : res;
        }, []);
        return results.some($isPromise) 
             ? Promise.all(results) 
             : results;
    }
}

export class NoBatch extends Trampoline {
    get canBatch() { return false; }
};
