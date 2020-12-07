import { $isNothing, $isPromise } from "miruken-core";
import { Handler } from "./handler";
import { Inquiry } from "./inquiry";
import { Composition } from "./composition";
import { provides } from "./callback-policy";

import { 
    Batch, NoBatch, Batching, BatchingComplete
 } from "./batch";

Handler.implement({
    /**
     * Prepares the Handler for batching.
     * @method $batch
     * @param   {Any}  [...tags]  -  tags to batch
     * @returns {Handler}  batching callback handler.
     * @for Handler
     */
    $batch(tags) {
        let _batch    = new Batch(tags),
            _complete = false,
            _promises = [];
        return this.decorate({
            //@provides(Batch)
            //get batch() { return _batch; },
            @provides(Batching)
            getBatcher(inquiry) {
                if (!$isNothing(_batch)) {
                    let batcher = _batch.resolve(inquiry.key);
                    if ($isNothing(batcher)) {
                        batcher = Reflect.construct(inquiry.key);
                        _batch.addHandlers(batcher);
                    }
                    return batcher;
                }
            },
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
    $noBatch() {
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                let inquiry;
                if (callback instanceof Inquiry) {
                    inquiry = callback;
                } else if (Composition.isComposed(callback, Inquiry)) {
                    inquiry = callback.callback;
                }
                return (inquiry?.key !== Batch) &&
                    this.base(new NoBatch(callback), greedy, composer);
            }
        });
    },
    $getBatch(tag) {
        const batch = this.resolve(Batch);
        if (!$isNothing(batch) && 
            ($isNothing(tag) || batch.shouldBatch(tag))) {
            return batch;
        }
    },
    $getBatcher(batcherType, tag) {
        if (!Batching.isAdoptedBy(batcherType)) {
            throw new TypeError(`Batcher ${batcherType.name} does not conform to Batching protocol.`);
        }
        const batch = this.resolve(Batch);
        if ($isNothing(batch)) return;
        let batcher = batch.resolve(batcherType);
        if ($isNothing(batcher)) {
            batcher = Reflect.construct(inquiry.key);
            batch.addHandlers(batcher);
        }
        return batcher;
    }
});
