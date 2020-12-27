import { 
    $isNothing, $isFunction, $isPromise,
    $flatten
} from "miruken-core";

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
    $batch(...args) {
        args = $flatten(args);
        if (args.length === 0) {
            throw new Error("Missing $batch block function.");
        }
        const block = args.pop();
        if (!$isFunction(block)) {
            throw new TypeError("The $batch block must be a function.");
        }
        let _batch    = new Batch(...args),
            _complete = false;
        const batcher = this.decorate({
            @provides(Batching)
            getBatcher(inquiry) {
                if (!$isNothing(_batch)) {
                    let batcher = _batch.resolve(inquiry.key);
                    if ($isNothing(batcher)) {
                        batcher = Reflect.construct(inquiry.key, []);
                        _batch.addHandlers(batcher);
                    }
                    return batcher;
                }
            },
            handleCallback(callback, greedy, composer) {
                if (_batch && callback.canBatch !== false) {
                    const b = _batch;
                    if (_complete && !(callback instanceof Composition)) {
                        _batch = null;
                    }
                    if (b.handle(callback, greedy, composer)) {
                        return true;
                    }
                }
                return this.base(callback, greedy, composer);
            }
        });

        const promise = block(batcher);

        _complete = true;
        const results = BatchingComplete(batcher).complete(batcher);
        if ($isPromise(promise)) {
            return $isPromise(results)
                 ? results.then(res => promise.then(() => res))
                 : promise.then(() => results);
        } 
        return results;
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
        if (!$isNothing(batch) && ($isNothing(tag) || batch.shouldBatch(tag))) {
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
            batcher = Reflect.construct(batcherType, []);
            batch.addHandlers(batcher);
        }
        return batcher;
    }
});
