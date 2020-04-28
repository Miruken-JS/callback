import {
    Base, Undefined, $isPromise, $isNothing
} from "miruken-core";

import { $handle } from "./policy";
import { DispatchingCallback, $unhandled } from "./callback";

/**
 * Callback representing a command with results.
 * @class Command
 * @constructor
 * @param   {Object}   callback  -  callback
 * @param   {boolean}  many      -  command cardinality
 * @extends Base
 */
export const Command = Base.extend(DispatchingCallback, {
    constructor(callback, many) {
        if ($isNothing(callback)) {
            throw new TypeError("The callback is required.");
        }
        many = !!many;
        let _pending = [],
            _tracked, _result;
        this.extend({
            /**
             * true if handle all, false otherwise.
             * @property {boolean} many
             * @readOnly
             */
            get isMany() { return many; },
            /**
             * Gets the callback.
             * @property {Object} callback
             * @readOnly
             */
            get callback() { return callback; },
            /**
             * Gets the pending promises.
             * @property {Array} pending
             * @readOnly
             */
            get pending() { return _pending; },
            /**
             * Gets the policy.
             * @property {Function} policy
             * @readOnly
             */         
            get policy() { return $handle; },              
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */               
            get callbackResult() {
                if (_result === undefined) {
                    if (_pending.length === 1) {
                        _result = Promise.resolve(_pending[0]);
                    } else if (_pending.length > 1) {
                        _result = Promise.all(_pending);
                    } else {
                        _result = Promise.resolve(_tracked);
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Tracks a pending promise.
             * @param {Promise}  promise - handle promise
             */
            track(promise) {
                if ((many || _pending.length === 0) && $isPromise(promise)) {
                    _pending.push(promise);
                    _result = undefined;
                }
                if (!_tracked) {
                    _tracked = true;
                    _result  = undefined;                        
                }
            },
            dispatch(handler, greedy, composer) {
                return $handle.dispatch(handler, this.callback, null,
                    composer, this.isMany, this.track) !== $unhandled;     
            }         
        });
    }
});

export default Command;