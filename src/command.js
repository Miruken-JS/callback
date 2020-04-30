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
        let _results  = [],
            _promises = [],
            _result;
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
             * Gets the results.
             * @property {Array} pending
             * @readOnly
             */
            get results() { return _results; },
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
                    if (_promises.length == 0) {
                        _result = many ? _results : _results[0];
                    } else {
                        _result = many 
                                ? Promise.all(_promises).then(() => _results)
                                : Promise.all(_promises).then(() => _results[0]);
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Tracks responses.
             * @param {Promise}  response - handle promise
             */
            respond(response) {
                if (response == null) return;
                if ($isPromise(response)) {
                    _promises.push(response.then(res => {
                        if (res != null) {
                            _results.push(res);
                        }
                    }));
                } else {
                    _results.push(response);
                }
            },
            dispatch(handler, greedy, composer) {
                var count = _results.length;
                return $handle.dispatch(handler, this.callback, null,
                    composer, this.isMany, this.respond) !== $unhandled || 
                    _results.length > count;     
            }         
        });
    }
});

export default Command;