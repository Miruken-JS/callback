import {
    Protocol, $isPromise, $flatten
} from "miruken-core";

import { Composition } from "./callback";
import { Handler, CompositeHandler } from "./handler";

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
 * @class Batcher
 * @constructor
 * @param   {Protocol}  [...protocols]  -  protocols to batch
 * @extends CompositeHandler
 * @uses Batching
 */
const BatchingComplete = Batching.extend();

export const Batcher = CompositeHandler.extend(BatchingComplete, {
    constructor(...protocols) {
        this.base();
        protocols = $flatten(protocols, true);
        this.extend({
            shouldBatch(protocol) {
                return protocol && (protocols.length == 0 ||
                    protocols.indexOf(protocol) >= 0); 
            }
        });
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

Handler.implement({
    /**
     * Prepares the Handler for batching.
     * @method $batch
     * @param   {Protocol}  [...protocols]  -  protocols to batch
     * @returns {Handler}  batching callback handler.
     * @for Handler
     */
    $batch(protocols) {
        let _batcher  = new Batcher(protocols),
            _complete = false,
            _promises = [];
        return this.decorate({
            $provide: [Batcher, () =>  _batcher ],
            handleCallback(callback, greedy, composer) {
                let handled = false;
                if (_batcher) {
                    const b = _batcher;
                    if (_complete && !(callback instanceof Composition)) {
                        _batcher = null;
                    }
                    if ((handled = b.handleCallback(callback, greedy, composer)) && !greedy) {
                        if (_batcher) {
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
    getBatcher(protocol) {
        const batcher = this.resolve(Batcher);
        if (batcher && (!protocol || batcher.shouldBatch(protocol))) {
            return batcher;
        }
    }  
});
