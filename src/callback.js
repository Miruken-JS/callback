import {
    Base, Undefined, $isPromise,
    $isNothing, $instant, $flatten
} from "miruken-core";

/**
 * Callback representing the invariant lookup of a key.
 * @class Lookup
 * @constructor
 * @param   {Any}      key   -  lookup key
 * @param   {boolean}  many  -  lookup cardinality
 * @extends Base
 */
export const Lookup = Base.extend({
    constructor(key, many) {
        if ($isNothing(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        let _results = [], _result,
            _instant = $instant.test(key);
        this.extend({
            /**
             * Gets the lookup key.
             * @property {Any} key
             * @readOnly
             */
            get key() { return key; },
            /**
             * true if lookup all, false otherwise.
             * @property {boolean} many
             * @readOnly
             */
            get isMany() { return many; },
            /**
             * Gets the matching results.
             * @property {Array} results
             * @readOnly
             */
            get results() { return _results; },
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */                
            get callbackResult() {
                if (_result === undefined) {
                    if (!many) {
                        if (_results.length > 0) {
                            _result = _results[0];
                        }
                    } else if (_instant) {
                        _result = $flatten(_results);
                    } else {
                        _result = Promise.all(_results).then($flatten);
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Adds a lookup result.
             * @param  {Any}  reault - lookup result
             */
            addResult(result) {
                if ((many || _results.length === 0) &&
                    !(_instant && $isPromise(result))) {
                    _results.push(result);
                    _result = undefined;
                }
            }
        });
    }
});

/**
 * Callback representing the deferred handling of another callback.
 * @class Deferred
 * @constructor
 * @param   {Object}   callback  -  callback
 * @param   {boolean}  many      -  deferred cardinality
 * @extends Base
 */
export const Deferred = Base.extend({
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
            }
        });
    }
});

/**
 * Callback representing the covariant resolution of a key.
 * @class Resolution
 * @constructor
 * @param   {any}      key   -  resolution key
 * @param   {boolean}  many  -  resolution cardinality
 * @extends Base
 */
export const Resolution = Base.extend({
    constructor(key, many) {
        if ($isNothing(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        let _resolutions = [],
            _promised    = false, _result,
            _instant     = $instant.test(key);
        this.extend({
            /**
             * Gets the key.
             * @property {Any} key
             * @readOnly
             */                
            get key() { return key; },
            /**
             * true if resolve all, false otherwise.
             * @property {boolean} isMany
             * @readOnly
             */                
            get isMany() { return many; },
            /**
             * true if resolve all is instant.  Otherwise a promise.
             * @property {boolean} instant
             * @readOnly
             */
            get instant() { return !_promised; },
            /**
             * Gets the resolutions.
             * @property {Array} resolutions
             * @readOnly
             */                
            get resolutions() { return _resolutions; },
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */
            get callbackResult() {
                if (_result === undefined) {
                    if (!many) {
                        const resolutions = $flatten(_resolutions, true);
                        if (resolutions.length > 0) {
                            _result = resolutions[0];
                        }
                    } else {
                        _result = !_promised
                            ? $flatten(_resolutions, true)
                            : Promise.all(_resolutions).then(res => $flatten(res, true));
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Adds a resolution.
             * @param  {Any}      resolution  -  resolution
             * @param  {Handler}  composer    -  composition handler
             * @returns {boolean} true if accepted, false otherwise.
             */
            resolve(resolution, composer) {
                if (!many && _resolutions.length > 0) {
                    return false;
                }
                if ($isPromise(resolution)) {
                    if (_instant) { return false; }
                    _promised = true;
                    resolution = resolution.then(r => {
                        if (this.isSatisfied(r)) { return r; }
                    });
                    if (many) {
                        resolution = resolution.catch(Undefined);
                    }
                } else if (!this.isSatisfied(resolution)) {
                    return false;
                }
                _resolutions.push(resolution);
                _result = undefined;
                return true;
            },
            /**
             * Determines if `resolution` is acceptable.
             * @param  {Any}      resolution  -  resolution
             * @param  {Handler}  composer    -  composition handler
             * @returns {boolean} true if accepted, false otherwise.
             */            
            isSatisfied(resolution, composer) {
                return true;
            }
        });
    }
});

/**
 * Marks a callback as composed.
 * @class Composition
 * @constructor
 * @param   {Object}   callback  -  callback to compose
 * @param   {Boolean}  greedy    -  true if handle greedily
 * @extends Base
 */
export const Composition = Base.extend({
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
                 * Gets/sets the effective callback result.
                 * @property {Any} callback result
                 */                
                get callbackResult() {
                    return callback.callbackResult;
                },
                set callbackResult(value) {
                    callback.callbackResult = value;
                }
            });
        }
    }
}, {
    isComposed(callback, type) {
        return callback instanceof this &&
            callback.callback instanceof type;
    }
});

/**
 * Identifies a rejected callback.  This usually occurs from aspect processing.
 * @class RejectedError
 * @constructor
 * @param {Object}  callback  -  rejected callback
 * @extends Error
 */
export function RejectedError(callback) {
    /**
     * Gets the rejected callback.
     * @property {Object} callback
     */         
    this.callback = callback;

    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Error.call(this);
    }
}
RejectedError.prototype             = new Error();
RejectedError.prototype.constructor = RejectedError;

/**
 * Identifies a timeout error.
 * @class TimeoutError
 * @constructor
 * @param {Object}  callback  -  timed out callback
 * @param {string}  message   -  timeout message
 * @extends Error
 */
export function TimeoutError(callback, message) {
    /**
     * Gets the rejected callback.
     * @property {Object} callback
     */         
    this.callback = callback;
    
    this.message = message || "Timeout occurred";
    
    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Error.call(this);
    }
}
TimeoutError.prototype             = new Error();
TimeoutError.prototype.constructor = TimeoutError;
