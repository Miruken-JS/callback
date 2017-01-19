import {
    Base, Undefined, MethodType,
    $isProtocol, $isPromise, $isFunction,
    $isNothing, $instant, $flatten
} from "miruken-core";

import { $unhandled } from "./definition";

export let $composer;

/**
 * Captures the invocation of a method.
 * @class HandleMethod
 * @constructor
 * @param  {number}    methodType  -  get, set or invoke
 * @param  {Protocol}  protocol    -  initiating protocol
 * @param  {string}    methodName  -  method name
 * @param  {Array}     [...args]   -  method arguments
 * @param  {boolean}   strict      -  true if strict, false otherwise
 * @extends Base
 */
export const HandleMethod = Base.extend({
    constructor(methodType, protocol, methodName, args, strict) {
        if (protocol && !$isProtocol(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        let _returnValue, _exception;
        this.extend({
            /**
             * Gets the type of method.
             * @property {number} methodType
             * @readOnly
             */
            get methodType() { return methodType; },
            /**
             * Gets the Protocol the method belongs to.
             * @property {Protocol} protocol
             * @readOnly
             */
            get protocol() { return protocol; },
            /**
             * Gets the name of the method.
             * @property {string} methodName
             * @readOnly
             */
            get methodName() { return methodName; },
            /**
             * Gets/sets the arguments of the method.
             * @property {Array} methodArgs
             * @readOnly
             */
            get methodArgs() { return args; },
            set methodArgs(value) { args = value; },
            /**
             * Get/sets the return value of the method.
             * @property {Any} returnValue.
             */
            get returnValue() { return _returnValue; },
            set returnValue(value) { _returnValue = value; },
            /**
             * Gets/sets the execption raised by the method.
             * @property {Any} method exception.
             */
            get exception() { return _exception; },
            set exception(exception) { _exception = exception; },
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */                
            get callbackResult() { return _returnValue; },
            set callbackResult(value) { _returnValue = value; },
            /**
             * Attempts to invoke the method on the target.<br/>
             * During invocation, the receiver will have access to a global **$composer** property
             * representing the initiating {{#crossLink "Handler"}}{{/crossLink}}.
             * @method invokeOn
             * @param   {Object}   target    -  method receiver
             * @param   {Handler}  composer  -  composition handler
             * @returns {boolean} true if the method was accepted.
             */
            invokeOn(target, composer) {
                if (!target || (strict && protocol && !protocol.isAdoptedBy(target))) {
                    return false;
                }
                let method, result;
                if (methodType === MethodType.Invoke) {
                    method = target[methodName];
                    if (!$isFunction(method)) {
                        return false;
                    }                    
                }
                const oldComposer = $composer;                    
                try {
                    $composer = composer;
                    switch (methodType) {
                    case MethodType.Get:
                        result = target[methodName];
                        break;
                    case MethodType.Set:
                        result = target[methodName] = args;
                        break;
                    case MethodType.Invoke:
                        result = method.apply(target, args);
                        break;
                    }
                    if (result === $unhandled) {
                        return false;
                    }
                    _returnValue = result;
                    return true;                        
                } catch (exception) {
                    _exception = exception;
                    throw exception;
                } finally {
                    $composer = oldComposer;
                }
            }
        });
    }
});

/**
 * Captures the invocation of a method using resolution to determine the targets.
 * @class ResolveMethod
 * @constructor
 * @param  {number}    methodType  -  get, set or invoke
 * @param  {Protocol}  protocol    -  initiating protocol
 * @param  {string}    methodName  -  method name
 * @param  {Array}     [...args]   -  method arguments
 * @param  {boolean}   strict      -  true if strict, false otherwise
 * @param  {boolean}   all         -  true if invoke all targets
 * @param  {boolean}   required    -  true if at least one target accepts
 * @extends HandleMethod
 */
export const ResolveMethod = HandleMethod.extend({
    constructor(methodType, protocol, methodName, args, strict, all, required) {
        this.base(methodType, protocol, methodName, args, strict);
        this.extend({
            /**
             * Attempts to invoke the method on resolved targets.
             * @method invokeResolve
             * @param   {Handler}  composer  - composition handler
             * @returns {boolean} true if the method was accepted.
             */
            invokeResolve(composer) {
                let handled = false,
                    targets = composer.resolveAll(protocol);
                
                if ($isPromise(targets)) {
                    this.returnValue = new Promise((resolve, reject) => {
                        targets.then(targets => {
                            invokeTargets.call(this, targets);
                            if (this.execption) {
                                reject(this.exeception);
                            } else if (handled) {
                                resolve(this.returnValue);
                            } else if (required) {
                                reject(new TypeError(`Object ${composer} has no method '${methodName}'`));
                            } else {
                                resolve();
                            }
                        }, reject);
                    });
                    return true;
                }
                
                invokeTargets.call(this, targets);

                function invokeTargets(targets) {
                    for (let i = 0; i < targets.length; ++i) {
                        handled = handled | this.invokeOn(targets[i], composer);
                        if (handled && !all) {
                            break;
                        }
                    }
                }
                
                return handled;
            }
        });
    }
});

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
 * @param   {Object}  callback  -  callback to compose
 * @extends Base
 */
export const Composition = Base.extend({
    constructor(callback) {
        if (callback) {
            this.extend({
                /**
                 * Gets the callback.
                 * @property {Object} callback
                 * @readOnly
                 */
                get callback() { return callback; },
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
