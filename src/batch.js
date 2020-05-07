import {
    Protocol, createKeyChain,
    $isPromise, $flatten
} from "miruken-core";

import Inquiry from "./inquiry";
import Handler from "./handler";
import Composition from "./composition";
import Trampoline from "./trampoline";
import CompositeHandler from "./composite-handler";

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
 * @constructor
 * @param   {Protocol}  [...protocols]  -  protocols to batch
 * @extends CompositeHandler
 * @uses Batching
 */
const BatchingComplete = Batching.extend();

export const Batch = CompositeHandler.extend(BatchingComplete, {
    constructor(...protocols) {
        this.base();
        _(this).protocols = $flatten(protocols, true);
    },

    shouldBatch(protocol) {
        const { protocols } = _(this);
        return protocol && (protocols.length == 0 ||
            protocols.indexOf(protocol) >= 0); 
    },
    complete(composer) {
        let promise = false,
            results = this.getHandlers().reduce((res, handler) => {
                const result = Batching(handler).complete(composer);
                if (result) {
                    promise = promise || $isPromise(result);
                    res.push(result);
                    return res;
                }
            }, []);
        return promise ? Promise.all(results) : results;
    }
});

export const NoBatch = Trampoline.extend({
    get canBatch() { return false },
    inferCallback() { return this; }
});

Handler.implement({
    /**
     * Prepares the Handler for batching.
     * @method $batch
     * @param   {Protocol}  [...protocols]  -  protocols to batch
     * @returns {Handler}  batching callback handler.
     * @for Handler
     */
    $batch(protocols) {
        let _batch    = new Batch(protocols),
            _complete = false,
            _promises = [];
        return this.decorate({
            $provide: [Batch, () =>  _batch ],
            handleCallback(callback, greedy, composer) {
                let handled = false;
                if (_batch && callback.canBatch !== false) {
                    const b = _batch;
                    if (_complete && !(callback instanceof Composition)) {
                        _batch = null;
                    }
                    if ((handled = b.handleCallback(callback, greedy, composer)) && !greedy) {
                        if (_batch) {
                            const result = callback.callbackResult;
                            if ($isPromise(result)) {
                                _promises.push(result);
                            }
                        }
                        return true;
                    }
                }
                return this.base(callback, greedy, composer) || handled;
            },
            dispose() {
                _complete = true;
                const results = BatchingComplete(this).complete(this);
                return _promises.length > 0
                    ? Promise.all(_promises).then(() => results)
                : results;
            }
        });            
    },
    noBatch() {
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                let inquiry;
                if (callback instanceof Inquiry) {
                    inquiry = callback;
                } else if (Composition.isComposed(callback, Inquiry)) {
                    inquiry = callback.callback;
                }
                return (inquiry == null || inquiry.key !== Batch) &&
                    this.base(new NoBatch(callback), greedy, composer);
            }
        });
    },
    getBatch(protocol) {
        const batch = this.resolve(Batch);
        if (batch && (!protocol || batch.shouldBatch(protocol))) {
            return batch;
        }
    }  
});
