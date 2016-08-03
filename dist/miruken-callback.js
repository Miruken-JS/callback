import {False,True,Undefined,Base,Abstract,extend,typeOf,assignID,Variance,MetaMacro,$meta,$isClass,$isString,$isFunction,$isNothing,$isProtocol,$classOf,Modifier,IndexedList,$eq,$use,$copy,$lift,$isPromise,$instant,$flatten,decorate,$decorator,$decorate,$decorated,StrictProtocol,Flags,Delegate,Resolving} from 'miruken-core';

const _definitions = {};

/**
 * Definition for handling callbacks contravariantly.
 * @method $handle
 * @for miruken.callback.$
 */
export const $handle = $define('$handle', Variance.Contravariant);
/**
 * Definition for providing callbacks covariantly.
 * @method $provide  
 * @for miruken.callback.$
 */        
export const $provide = $define('$provide', Variance.Covariant);
/**
 * Definition for matching callbacks invariantly.
 * @method $lookup  
 * @for miruken.callback.$
 */                
export const $lookup = $define('$lookup', Variance.Invariant);
/**
 * return value to indicate a callback was not handled.
 * @property {Object} $NOT_HANDLED
 * @for miruken.callback.$
 */                
export const $NOT_HANDLED = Object.freeze({});

/**
 * Metamacro to process callback handler definitions.
 * <pre>
 *    const Bank = Base.extend(**$callbacks**, {
 *        $handle: [
 *            Deposit, function (deposit, composer) {
 *                // perform the deposit
 *            }
 *        ]
 *    })
 * </pre>
 * would register a handler in the Bank class for Deposit callbacks.
 * @class $callbacks
 * @extends miruken.MetaMacro
 */
export const $callbacks = MetaMacro.extend({
    get active() { return true; },
    get inherit() { return true; },
    execute(step, metadata, target, definition) {
        if ($isNothing(definition)) {
            return;
        }
        const source = target,
              type   = metadata.type;
        if (target === type.prototype) {
            target = type;
        }
        for (let tag in _definitions) {
            const list = this.extractProperty(tag, source, definition);
            if (!list || list.length == 0) {
                continue;
            }
            const define = _definitions[tag];
            for (let idx = 0; idx < list.length; ++idx) {
                const constraint = list[idx];
                if (++idx >= list.length) {
                    throw new Error(
                        `Incomplete ${tag} definition: missing handler for constraint ${constraint}.`);
                }
                define(target, constraint, list[idx]);
            }
        }
    }
});

/**
 * Defines a new handler grouping.
 * This is the main extensibility point for handling callbacks.
 * @method $define
 * @param   {string}           tag       - group tag
 * @param   {miruken.Variance} variance  - group variance
 * @return  {Function} function to add to a group.
 * @throws  {TypeError} if group already defined.
 * @for $
 */
export function $define(tag, variance) {
    if (!$isString(tag) || tag.length === 0 || /\s/.test(tag)) {
        throw new TypeError("The tag must be a non-empty string with no whitespace.");
    } else if (_definitions[tag]) {
        throw new TypeError(`'${tag}' is already defined.`);
    }

    let handled, comparer;
    variance = variance || Variance.Contravariant;
    if (!(variance instanceof Variance)) {
        throw new TypeError("Invalid variance type supplied");
    }
    
    switch (variance) {
    case Variance.Covariant:
        handled  = requiresResult;
        comparer = compareCovariant; 
        break;
    case Variance.Contravariant:
        handled  = impliesSuccess;
        comparer = compareContravariant; 
        break;
    case Variance.Invariant:
        handled  = requiresResult;
        comparer = compareInvariant; 
        break;
    }

    function definition(owner, constraint, handler, removed) {
        if (Array.isArray(constraint)) {
            if (constraint.length == 1) {
                constraint = constraint[0];
            } else {
                return constraint.reduce((result, c) => {
                    const undefine = _definition(owner, c, handler, removed);
                    return notifyRemoved => {
                        result(notifyRemoved);
                        undefine(notifyRemoved);
                    };
                }, Undefined);
            }
        }
        return _definition(owner, constraint, handler, removed);
    }
    function _definition(owner, constraint, handler, removed) {
        if ($isNothing(owner)) {
            throw new TypeError("Definitions must have an owner.");
        } else if ($isNothing(handler)) {
            handler    = constraint;
            constraint = $classOf(Modifier.unwrap(constraint));
        }
        if ($isNothing(handler)) {
            throw new TypeError(
                `Incomplete '${tag}' definition: missing handler for constraint ${constraint}`);
        } else if (removed && !$isFunction(removed)) {
            throw new TypeError("The removed argument is not a function.");
        }
        if (!$isFunction(handler)) {
            if ($copy.test(handler)) {
                const source = Modifier.unwrap(handler);
                if (!$isFunction(source.copy)) {
                    throw new Error("$copy requires the target to have a copy method.");
                }
                handler = source.copy.bind(source);
            } else {
                const source = $use.test(handler) ? Modifier.unwrap(handler) : handler;
                handler = $lift(source);
            }
        }
        const meta  = $meta(owner),
              node  = new Node(constraint, handler, removed),
              index = createIndex(node.constraint),
              list  = meta[tag] || (meta[tag] = new IndexedList(comparer));
        list.insert(node, index);
        return function (notifyRemoved) {
            list.remove(node);
            if (list.isEmpty()) {
                delete meta[tag];
            }
            if (node.removed && (notifyRemoved !== false)) {
                node.removed(owner);
            }
        };
    };
    definition.removeAll = function (owner) {
        const meta = $meta(owner),
              list = meta[tag];
        let   head = list.head;
        while (head) {
            if (head.removed) {
                head.removed(owner);
            }
            head = head.next;
        }
        delete meta[tag];
    };
    definition.dispatch = function (handler, callback, constraint, composer, all, results) {
        let   v        = variance;
        const delegate = handler.delegate;
        constraint = constraint || callback;
        if (constraint) {
            if ($eq.test(constraint)) {
                v = Variance.Invariant;
            }
            constraint = Modifier.unwrap(constraint);
            if (typeOf(constraint) === 'object') {
                constraint = $classOf(constraint);
            }
        }
        let ok = delegate && _dispatch(delegate, $meta(delegate), callback, constraint, v, composer, all, results);
        if (!ok || all) {
            ok = ok || _dispatch(handler, $meta(handler), callback, constraint, v, composer, all, results);
        }
        return ok;
    };
    function _dispatch(target, meta, callback, constraint, v, composer, all, results) {
        let   dispatched = false;
        const invariant  = (v === Variance.Invariant),
              index      = meta && createIndex(constraint);
        while (meta) {
            const list = meta[tag];
            if (list && (!invariant || index)) {
                let node = list.getIndex(index) || list.head;
                while (node) {
                    if (node.match(constraint, v)) {
                        const base       = target.base;
                        let   baseCalled = false;
                        target.base    = function () {
                            let baseResult;
                            baseCalled = true;
                            _dispatch(target, meta.parent, callback, constraint, v, composer, false,
                                      function (result) { baseResult = result; });
                            return baseResult;
                        };
                        try {
                            const result = node.handler.call(target, callback, composer);
                            if (handled(result)) {
                                if (results) {
                                    results.call(callback, result);
                                }
                                if (!all) {
                                    return true;
                                }
                                dispatched = true;
                            } else if (baseCalled) {
                                if (!all) {
                                    return false;
                                }
                            }
                        } finally {
                            target.base = base;
                        }
                    } else if (invariant) {
                        break;  // stop matching if invariant not satisifed
                    }
                    node = node.next;
                }
            }
            meta = meta.parent;
        }
        return dispatched;
    }
    definition.tag      = tag;
    definition.variance = variance;
    Object.freeze(definition);
    _definitions[tag] = definition;
    return definition;
}

export function Node(constraint, handler, removed) {
    const invariant = $eq.test(constraint);
    constraint      = Modifier.unwrap(constraint);
    this.constraint = constraint;
    this.handler    = handler;
    if ($isNothing(constraint)) {
        this.match = invariant ? False : matchEverything;
    } else if ($isProtocol(constraint)) {
        this.match = invariant ? matchInvariant : matchProtocol;
    } else if ($isClass(constraint)) {
        this.match = invariant ? matchInvariant : matchClass;
    } else if ($isString(constraint)) {
        this.match = matchString;
    } else if (constraint instanceof RegExp) {
        this.match = invariant ? False : matchRegExp;
    } else if ($isFunction(constraint)) {
        this.match = constraint;
    } else {
        this.match = False;
    }
    if (removed) {
        this.removed = removed;
    }
}

function createIndex(constraint) {
    if (constraint) {
        if ($isString(constraint)) {
            return constraint;
        } else if ($isFunction(constraint)) {
            return assignID(constraint);
        }
    }
}

function matchInvariant(match) {
    return this.constraint === match;
}

function matchEverything(match, variance) {
    return variance !== Variance.Invariant;
}

function matchProtocol(match, variance) {
    const constraint = this.constraint;
    if (constraint === match) {
        return true;
    } else if (variance === Variance.Covariant) {
        return constraint.conformsTo(match);
    } else if (variance === Variance.Contravariant) {
        return match.conformsTo && match.conformsTo(constraint);
    }
    return false;
}

function matchClass(match, variance) {
    const constraint = this.constraint;
    if (constraint === match) {
        return true;
    } else if (variance === Variance.Contravariant) {
        return match.prototype instanceof constraint;
    }
    else if (variance === Variance.Covariant) {
        return match.prototype &&
            (constraint.prototype instanceof match
             || ($isProtocol(match) && match.adoptedBy(constraint)));
    }
    return false;
}

function matchString(match) {
    return $isString(match) && this.constraint == match;
}

function matchRegExp(match, variance) {
    return (variance !== Variance.Invariant) && this.constraint.test(match);
}

function compareCovariant(node, insert) {
    if (insert.match(node.constraint, Variance.Invariant)) {
        return 0;
    } else if (insert.match(node.constraint, Variance.Covariant)) {
        return -1;
    }
    return 1;
}

function compareContravariant(node, insert) {
    if (insert.match(node.constraint, Variance.Invariant)) {
        return 0;
    } else if (insert.match(node.constraint, Variance.Contravariant)) {
        return -1;
    }
    return 1;
}

function compareInvariant(node, insert) {
    return insert.match(node.constraint, Variance.Invariant) ? 0 : -1;
}

function requiresResult(result) {
    return ((result !== null) && (result !== undefined) && (result !== $NOT_HANDLED));
}

function impliesSuccess(result) {
    return result ? (result !== $NOT_HANDLED) : (result === undefined);
}

export let $composer;

/**
 * Captures the invocation of a method.
 * @class HandleMethod
 * @constructor
 * @param  {number}            type        -  get, set or invoke
 * @param  {miruken.Protocol}  protocol    -  initiating protocol
 * @param  {string}            methodName  -  method name
 * @param  {Array}             [...args]   -  method arguments
 * @param  {boolean}           strict      -  true if strict, false otherwise
 * @extends Base
 */
export const HandleMethod = Base.extend({
    constructor(type, protocol, methodName, args, strict) {
        if (protocol && !$isProtocol(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        let _returnValue, _exception;
        this.extend({
            /**
             * Gets the type of method.
             * @property {number} type
             * @readOnly
             */
            get type() { return type; },
            /**
             * Gets the Protocol the method belongs to.
             * @property {miruken.Protocol} protocol
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
             * Gets the arguments of the method.
             * @property {Array} arguments
             * @readOnly
             */
            get arguments() { return args; },
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
             * representing the initiating {{#crossLink "miruken.callback.CallbackHandler"}}{{/crossLink}}.
             * @method invokeOn
             * @param   {Object}                            target    -  method receiver
             * @param   {miruken.callback.CallbackHandler}  composer  -  composition handler
             * @returns {boolean} true if the method was accepted.
             */
            invokeOn(target, composer) {
                if (!target || (strict && protocol && !protocol.adoptedBy(target))) {
                    return false;
                }
                let method, result;
                if (type === HandleMethod.Invoke) {
                    method = target[methodName];
                    if (!$isFunction(method)) {
                        return false;
                    }                    
                }
                const oldComposer = $composer;                    
                try {
                    $composer = composer;
                    switch (type) {
                    case HandleMethod.Get:
                        result = target[methodName];
                        break;
                    case HandleMethod.Set:
                        result = target[methodName] = args;
                        break;
                    case HandleMethod.Invoke:
                        result = method.apply(target, args);
                        break;
                    }
                    if (result === $NOT_HANDLED) {
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
}, {
    /**
     * Identifies a property get.
     * @property {number} Get
     * @static
     */
    Get: 1,
    /**
     * Identifies a property set.
     * @property {number} Set
     * @static
     */
    Set: 2,
    /**
     * Identifies a method invocation.
     * @property {number} Invoke
     * @static
     */
    Invoke: 3
});

/**
 * Captures the invocation of a method using resolution to determine the targets.
 * @class ResolveMethod
 * @constructor
 * @param  {number}            type        -  get, set or invoke
 * @param  {miruken.Protocol}  protocol    -  initiating protocol
 * @param  {string}            methodName  -  method name
 * @param  {Array}             [...args]   -  method arguments
 * @param  {boolean}           strict      -  true if strict, false otherwise
 * @param  {boolean}           all         -  true if invoke all targets
 * @param  {boolean}           required    -  true if at least one target accepts
 * @extends HandleMethod
 */
export const ResolveMethod = HandleMethod.extend({
    constructor(type, protocol, methodName, args, strict, all, required) {
        this.base(type, protocol, methodName, args, strict);
        this.extend({
            /**
             * Attempts to invoke the method on resolved targets.
             * @method invokeResolve
             * @param   {miruken.callback.CallbackHandler}  composer  - composition handler
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
                        _result = Promise.resolve(_pending[0]).then(True);
                    } else if (_pending.length > 1) {
                        _result = Promise.all(_pending).then(True);
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
 * @param   {any}   key      -  resolution key
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
                        _result = this.instant
                            ? $flatten(_resolutions, true)
                            : Promise.all(_resolutions).then(res => $flatten(res, true));
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Adds a resolution.
             * @param {Any} resolution  -  resolution
             */
            resolve(resolution) {
                if (!many && _resolutions.length > 0) {
                    return;
                }
                const promised = $isPromise(resolution);
                if (!_instant || !promised) {
                    _promised = _promised || promised;
                    if (promised && many) {
                        resolution = resolution.catch(Undefined);
                    }
                    _resolutions.push(resolution);
                    _result   = undefined;
                }
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
RejectedError.prototype             = new Error;
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
TimeoutError.prototype             = new Error;
TimeoutError.prototype.constructor = TimeoutError;

const Everything = [null];

export function build(definition) {
    return function decorate(target, key, descriptor, constraints) {
        if (constraints.length === 0) {
            constraints = Everything;
        }
        if (definition && definition.tag) {
            const spec = target[definition.tag]
                      || (target[definition.tag] = []);
            function lateBinding() {
                const result = this[key];
                if ($isFunction(result)) {
                    return result.apply(this, arguments);
                }
                if (definition.variance == Variance.Covariant) {
                    return result;
                }
                return $NOT_HANDLED;
            }
            spec.push(constraints, lateBinding);
        }
        return descriptor;
    };
}

export function callback(definition, ...args) {
    if (definition == null) {
        definition = $handle;
    }
    return decorate(build(definition), args);
}

export function handle(...args) {
    return decorate(build($handle), args);
}

export function provide(...args) {
    return decorate(build($provide), args);    
}

/**
 * Base class for handling arbitrary callbacks.<br/>
 * See {{#crossLink "miruken.callback.$callbacks"}}{{/crossLink}}
 * @class CallbackHandler
 * @constructor
 * @param  {Object}  [delegate]  -  delegate
 * @extends Base
 */
export const CallbackHandler = Base.extend($callbacks, {
    constructor(delegate) {
        this.extend({
            /**
             * Gets the delegate.
             * @property {Object} delegate
             * @readOnly
             */            
            get delegate() { return delegate; }
        });
    },
    /**
     * Handles the callback.
     * @method handle
     * @param   {Object}                           callback        -  any callback
     * @param   {boolean}                          [greedy=false]  -  true if handle greedily
     * @param   {miruken.callback.CallbackHandler} [composer]      -  composition handler
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
    },
    /**
     * Handles the callback with all arguments populated.
     * @method handleCallback
     * @param   {Object}                           callback    -  any callback
     * @param   {boolean}                          greedy      -  true if handle greedily
     * @param   {miruken.callback.CallbackHandler} [composer]  -  composition handler
     * @returns {boolean} true if the callback was handled, false otherwise.
     */
    handleCallback(callback, greedy, composer) {
        return $handle.dispatch(this, callback, null, composer, greedy);
    },
    $handle:[
        Lookup, function (lookup, composer) {
            return $lookup.dispatch(this, lookup,lookup.key, composer, lookup.isMany, lookup.addResult);
        },
        Deferred, function (deferred, composer) {
            return $handle.dispatch(this, deferred.callback, null, composer, deferred.isMany, deferred.track);
        },
        Resolution, function (resolution, composer) {
            const key      = resolution.key,
                  many     = resolution.isMany;
            let   resolved = $provide.dispatch(this, resolution, key, composer, many, resolution.resolve);
            if (!resolved) { // check if delegate or handler implicitly satisfy key
                const implied  = new Node(key),
                    delegate = this.delegate;
                if (delegate && implied.match($classOf(delegate), Variance.Contravariant)) {
                    resolution.resolve($decorated(delegate, true));
                    resolved = true;
                }
                if ((!resolved || many) && implied.match($classOf(this), Variance.Contravariant)) {
                    resolution.resolve($decorated(this, true));
                    resolved = true;
                }
            }
            return resolved;
        },
        HandleMethod, function (method, composer) {
            return method.invokeOn(this.delegate, composer) || method.invokeOn(this, composer);
        },
        ResolveMethod, function (method, composer) {
            return method.invokeResolve(composer);
        },
        Composition, function (composable, composer) {
            const callback = composable.callback;
            return callback && $handle.dispatch(this, callback, null, composer);
        }
    ]
}, {
    coerce(object) { return new this(object); }
});

Base.implement({
    toCallbackHandler() { return CallbackHandler(this); }
});

const compositionScope = $decorator({
    isCompositionScope() { return true; },
    handleCallback(callback, greedy, composer) {
        if (!(callback instanceof Composition)) {
            callback = new Composition(callback);
        }
        return this.base(callback, greedy, composer);
    }
});

/**
 * Represents a two-way
 * {{#crossLink "miruken.callback.CallbackHandler"}}{{/crossLink}} path.
 * @class CascadeCallbackHandler
 * @constructor
 * @param  {miruken.callback.CallbackHandler}  handler           -  primary handler
 * @param  {miruken.callback.CallbackHandler}  cascadeToHandler  -  secondary handler
 * @extends miruken.callback.CallbackHandler
 */
export const CascadeCallbackHandler = CallbackHandler.extend({
    constructor(handler, cascadeToHandler) {
        if ($isNothing(handler)) {
            throw new TypeError("No handler specified.");
        } else if ($isNothing(cascadeToHandler)) {
            throw new TypeError("No cascadeToHandler specified.");
        }
        handler          = handler.toCallbackHandler();
        cascadeToHandler = cascadeToHandler.toCallbackHandler();
        this.extend({
            /**
             * Gets the primary handler.
             * @property {miruken.callback.CallbackHandler} handler
             * @readOnly
             */
            get handler() { return handler; },
            /**
             * Gets the secondary handler.
             * @property {miruken.callback.CallbackHandler} cascadeToHandler
             * @readOnly
             */
            get cascadeToHandler() { return cascadeToHandler; }                
        });
    },
    handleCallback(callback, greedy, composer) {
        let handled = greedy
            ? (this.handler.handleCallback(callback, true, composer)
               | this.cascadeToHandler.handleCallback(callback, true, composer))
            : (this.handler.handleCallback(callback, false, composer)
               || this.cascadeToHandler.handleCallback(callback, false, composer));
        if (!handled || greedy) {
            handled = this.base(callback, greedy, composer) || handled;
        }
        return !!handled;
    }
});

/**
 * Encapsulates zero or more
 * {{#crossLink "miruken.callback.CallbackHandler"}}{{/crossLink}}.<br/>
 * See [Composite Pattern](http://en.wikipedia.org/wiki/Composite_pattern)
 * @class CompositeCallbackHandler
 * @constructor
 * @param  {Arguments}  arguments  -  callback handlers
 * @extends miruken.callback.CallbackHandler
 */
export const CompositeCallbackHandler = CallbackHandler.extend({
    constructor(...handlers) {
        let _handlers = [];
        this.extend({
            /**
             * Gets all participating callback handlers.
             * @method getHandlers
             * @returns {Array} participating callback handlers.
             */
            getHandlers() { return _handlers.slice(); },
            /**
             * Adds the callback handlers to the composite.
             * @method addHandlers
             * @param   {Any}  ...handlers  -  handlers to add
             * @returns {miruken.callback.CompositeCallbackHandler}  composite
             * @chainable
             */
            addHandlers(...handlers) {
                handlers = $flatten(handlers, true).map(h => h.toCallbackHandler());
                _handlers.push(...handlers);
                return this;
            },
            /**
             * Adds the callback handlers to the composite.
             * @method addHandlers
             * @param   {number}  atIndex      -  index to insert at
             * @param   {Any}     ...handlers  -  handlers to insert
             * @returns {miruken.callback.CompositeCallbackHandler}  composite
             * @chainable
             */
            insertHandlers(atIndex, ...handlers) {
                handlers = $flatten(handlers, true).map(h => h.toCallbackHandler());
                _handlers.splice(atIndex, ...handlers);                
                return this;                    
            },                
            /**
             * Removes callback handlers from the composite.
             * @method removeHandlers
             * @param   {Any}  ...handlers  -  handlers to remove
             * @returns {miruken.callback.CompositeCallbackHandler}  composite
             * @chainable
             */
            removeHandlers(...handlers) {
                $flatten(handlers).forEach(handler => {
                    if (!handler) {
                        return;
                    }
                    const count = _handlers.length;
                    for (let idx = 0; idx < count; ++idx) {
                        const testHandler = _handlers[idx];
                        if (testHandler == handler || testHandler.delegate == handler) {
                            _handlers.splice(idx, 1);
                            return;
                        }
                    }
                });
                return this;
            },
            handleCallback(callback, greedy, composer) {
                let handled = false,
                    count   = _handlers.length;
                for (let idx = 0; idx < count; ++idx) {
                    const handler = _handlers[idx];
                    if (handler.handleCallback(callback, greedy, composer)) {
                        if (!greedy) {
                            return true;
                        }
                        handled = true;
                    }
                }
                return this.base(callback, greedy, composer) || handled;
            }
        });
        this.addHandlers(handlers);
    }
});

/**
 * Shortcut for handling a callback.
 * @method
 * @static
 * @param   {Function}  handler     -  handles callbacks
 * @param   {Any}       constraint  -  callback constraint
 * @returns {miruken.callback.CallbackHandler} callback handler.
 * @for miruken.callback.CallbackHandler
 */
CallbackHandler.accepting = function (handler, constraint) {
    const accepting = new CallbackHandler();
    $handle(accepting, constraint, handler);
    return accepting;
};

/**
 * Shortcut for providing a callback.
 * @method
 * @static
 * @param  {Function}  provider    -  provides callbacks
 * @param  {Any}       constraint  -  callback constraint
 * @returns {miruken.callback.CallbackHandler} callback provider.
 * @for miruken.callback.CallbackHandler
 */
CallbackHandler.providing = function (provider, constraint) {
    const providing = new CallbackHandler();
    $provide(providing, constraint, provider);
    return providing;
};

/**
 * Shortcut for handling a 
 * {{#crossLink "miruken.callback.HandleMethod"}}{{/crossLink}} callback.
 * @method
 * @static
 * @param  {string}    methodName  -  method name
 * @param  {Function}  method      -  method function
 * @returns {miruken.callback.CallbackHandler} method handler.
 * @for miruken.callback.CallbackHandler
 */
CallbackHandler.implementing = function (methodName, method) {
    if (!$isString(methodName) || methodName.length === 0 || !methodName.trim()) {
        throw new TypeError("No methodName specified.");
    } else if (!$isFunction(method)) {
        throw new TypeError(`Invalid method: ${method} is not a function.`);
    }
    return (new CallbackHandler()).extend({
        handleCallback(callback, greedy, composer) {
            if (callback instanceof HandleMethod) {
                const target = new Object();
                target[methodName] = method;
                return callback.invokeOn(target);
            }
            return false;
        }
    });
};

CallbackHandler.implement({
    /**
     * Asynchronusly handles the callback.
     * @method defer
     * @param   {Object}  callback  -  callback
     * @returns {Promise} promise to handled callback.
     * @for miruken.callback.CallbackHandler
     * @async
     */                        
    defer(callback) {
        const deferred = new Deferred(callback);
        this.handle(deferred, false, $composer);
        return deferred.callbackResult;            
    },
    /**
     * Asynchronusly handles the callback greedily.
     * @method deferAll
     * @param   {Object}  callback  -  callback
     * @returns {Promise} promise to handled callback.
     * @for miruken.callback.CallbackHandler
     * @async
     */                                
    deferAll(callback) {
        const deferred = new Deferred(callback, true);
        this.handle(deferred, true, $composer);
        return deferred.callbackResult;
    },
    /**
     * Resolves the key.
     * @method resolve
     * @param   {Any}  key  -  key
     * @returns {Any}  resolved key.  Could be a promise.
     * @for miruken.callback.CallbackHandler
     * @async
     */                                
    resolve(key) {
        const resolution = (key instanceof Resolution) ? key : new Resolution(key);
        if (this.handle(resolution, false, $composer)) {
            return resolution.callbackResult;
        }
    },
    /**
     * Resolves the key greedily.
     * @method resolveAll
     * @param   {Any}   key  -  key
     * @returns {Array} resolved key.  Could be a promise.
     * @for miruken.callback.CallbackHandler
     * @async
     */                                        
    resolveAll(key) {
        const resolution = (key instanceof Resolution) ? key : new Resolution(key, true);
        return this.handle(resolution, true, $composer)
            ? resolution.callbackResult
            : [];
    },
    /**
     * Looks up the key.
     * @method lookup
     * @param   {Any}  key  -  key
     * @returns {Any}  value of key.
     * @for miruken.callback.CallbackHandler
     */                                        
    lookup(key) {
        const lookup = (key instanceof Lookup) ? key : new Lookup(key);
        if (this.handle(lookup, false, $composer)) {
            return lookup.callbackResult;
        }
    },
    /**
     * Looks up the key greedily.
     * @method lookupAll
     * @param   {Any}  key  -  key
     * @returns {Array}  value(s) of key.
     * @for miruken.callback.CallbackHandler
     */                                                
    lookupAll(key) {
        const lookup = (key instanceof Lookup) ? key : new Lookup(key, true);
        return this.handle(lookup, true, $composer)
            ? lookup.callbackResult
            : [];
    },
    /**
     * Decorates the handler.
     * @method decorate
     * @param   {Object}  decorations  -  decorations
     * @returns {miruken.callback.CallbackHandler} decorated callback handler.
     * @for miruken.callback.CallbackHandler
     */        
    decorate(decorations) {
        return $decorate(this, decorations);
    },
    /**
     * Decorates the handler for filtering callbacks.
     * @method filter
     * @param   {Function}  filter     -  filter
     * @param   {boolean}   reentrant  -  true if reentrant, false otherwise
     * @returns {miruken.callback.CallbackHandler} filtered callback handler.
     * @for miruken.callback.CallbackHandler
     */                                                        
    filter(filter, reentrant) {
        if (!$isFunction(filter)) {
            throw new TypeError(`Invalid filter: ${filter} is not a function.`);
        }
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                if (!reentrant && (callback instanceof Composition)) {
                    return this.base(callback, greedy, composer);
                }
                const base = this.base;
                return filter(callback, composer, () =>
                    base.call(this, callback, greedy, composer));
            }
        });
    },
    /**
     * Decorates the handler for applying aspects to callbacks.
     * @method aspect
     * @param   {Function}  before     -  before action.  Return false to reject
     * @param   {Function}  action     -  after action
     * @param   {boolean}   reentrant  -  true if reentrant, false otherwise
     * @returns {miruken.callback.CallbackHandler}  callback handler aspect.
     * @throws  {RejectedError} An error if before returns an unaccepted promise.
     * @for miruken.callback.CallbackHandler
     */
    aspect(before, after, reentrant) {
        return this.filter((callback, composer, proceed) => {
            if ($isFunction(before)) {
                const test = before(callback, composer);
                if ($isPromise(test)) {
                    const hasResult = "callbackResult" in callback,
                          accept    = test.then(accepted => {
                            if (accepted !== false) {
                                aspectProceed(callback, composer, proceed, after, accepted);
                                return hasResult ? callback.callbackResult : true;
                            }
                            return Promise.reject(new RejectedError(callback));
                        });
                    if (hasResult) {
                        callback.callbackResult = accept;                            
                    }
                    return true;
                } else if (test === false) {
                    throw new RejectedError(callback);
                }
            }
            return aspectProceed(callback, composer, proceed, after);
        }, reentrant);
    },
    /**
     * Decorates the handler to handle definitions.
     * @method $handle
     * @param   {Array}  [definitions]  -  handler overrides
     * @returns {miruken.callback.CallbackHandler}  decorated callback handler.
     * @for miruken.callback.CallbackHandler
     */
    $$handle(definitions) {
        return this.decorate({$handle: definitions});
    },
    /**
     * Decorates the handler to provide definitions.
     * @method $handle
     * @param   {Array}  [definitions]  -  provider overrides
     * @returns {miruken.callback.CallbackHandler}  decorated callback handler.
     * @for miruken.callback.CallbackHandler
     */
    $$provide(definitions) {
        return this.decorate({$provide: definitions});
    },
    /**
     * Decorates the handler to conditionally handle callbacks.
     * @method when
     * @param   {Any}  constraint  -  matching constraint
     * @returns {miruken.callback.ConditionalCallbackHandler}  conditional callback handler.
     * @for miruken.callback.CallbackHandler
     */                                                                        
    when(constraint) {
        const when = new Node(constraint),
            condition = callback => {
                if (callback instanceof Deferred) {
                    return when.match($classOf(callback.callback), Variance.Contravariant);
                } else if (callback instanceof Resolution) {
                    return when.match(callback.key, Variance.Covariant);
                } else {
                    return when.match($classOf(callback), Variance.Contravariant);
                }
            };
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                return condition(callback) && this.base(callback, greedy, composer);
            }
        });
    },
    /**
     * Builds a handler chain.
     * @method next
     * @param   {Arguments}  arguments  -  handler chain members
     * @returns {miruken.callback.CallbackHandler}  chaining callback handler.
     * @for miruken.callback.CallbackHandler
     */                                                                                
    next(...handlers) {
        switch(handlers.length) {
        case 0:  return this;
        case 1:  return new CascadeCallbackHandler(this, handlers[0])
        default: return new CompositeCallbackHandler(this, ...handlers);
        }
    },
    /**
     * Prevents continuous or concurrent handling on a target.
     * @method $guard
     * @param   {Object}  target              -  target to guard
     * @param   {string}  [property='guard']  -  property for guard state
     * @returns {miruken.callback.CallbackHandler}  guarding callback handler.
     * @for miruken.callback.CallbackHandler
     */        
    $guard(target, property) {
        if (target) {
            let guarded = false;
            property = property || "guarded";
            const propExists = property in target;
            return this.aspect(() => {
                if ((guarded = target[property])) {
                    return false;
                }
                target[property] = true;
                return true;
            }, () => {
                if (!guarded) {
                    target[property] = undefined;
                    if (!propExists) {
                        delete target[property];
                    }
                }
            });
        }
        return this;
    },
    /**
     * Tracks the activity counts associated with a target. 
     * @method $activity
     * @param   {Object}  target                 -  target to track
     * @param   {Object}  [ms=50]                -  delay to wait before tracking
     * @param   {string}  [property='activity']  -  property for activity state
     * @returns {miruken.callback.CallbackHandler}  activity callback handler.
     * @for miruken.callback.CallbackHandler
     */                
    $activity(target, ms, property) {
        property = property || "$$activity";
        const propExists = property in target;            
        return this.aspect(() => {
            const state = { enabled: false };
            setTimeout(() => {
                if ("enabled" in state) {
                    state.enabled = true;
                    let activity = target[property] || 0;
                    target[property] = ++activity;
                }
            }, $isSomething(ms) ? ms : 50);
            return state;
        }, (_, composer, state) => {
            if (state.enabled) {
                let activity = target[property];
                if (!activity || activity === 1) {
                    target[property] = undefined;
                    if (!propExists) {
                        delete target[property];
                    }
                } else {
                    target[property] = --activity;
                }
            }
            delete state.enabled;
        });
    },
    /**
     * Ensures all return values are promises..
     * @method $promises
     * @returns {miruken.callback.CallbackHandler}  promising callback handler.
     * @for miruken.callback.CallbackHandler
     */                
    $promise() {
        return this.filter((callback, composer, proceed) => {
            try {                
                const handled = proceed();
                if (handled) {
                    const result = callback.callbackResult;                    
                    callback.callbackResult = $isPromise(result)
                        ? result : Promise.resolve(result);
                }
                return handled;
            } catch (ex) {
                callback.callbackResult = Promise.reject(ex);
                return true;
            }
        });
    },        
    /**
     * Configures the receiver to set timeouts on all promises.
     * @method $timeout
     * @param   {number}             ms       -  duration before promise times out
     * @param   {Function | Error}   [error]  -  error instance or custom error class
     * @returns {miruken.callback.CallbackHandler}  timeout callback handler.
     * @for miruken.callback.CallbackHandler
     */        
    $timeout(ms, error) {
        return this.filter((callback, composer, proceed) => {
            const handled = proceed();
            if (handled) {
                const result = callback.callbackResult;
                if ($isPromise(result)) {
                    callback.callbackResult = new Promise(function (resolve, reject) {
                        let timeout;
                        result.then(res => {
                            if (timeout) {
                                clearTimeout(timeout);
                            }
                            resolve(res);
                        }, err => {
                            if (timeout) {
                                clearTimeout(timeout);
                            }
                            reject(err);                                
                        });
                        timeout = setTimeout(function () {
                            if (!error) {
                                error = new TimeoutError(callback);
                            } else if ($isFunction(error)) {
                                error = Reflect.construct(error, [callback]);
                            }
                            if ($isFunction(result.reject)) {
                                result.reject(error);  // TODO: cancel
                            }
                            reject(error);
                        }, ms);
                    });
                }
            }
            return handled;
        });
    },
});

function aspectProceed(callback, composer, proceed, after, state) {
    let promise;
    try {
        const handled = proceed();
        if (handled) {
            const result = callback.callbackResult;
            if ($isPromise(result)) {
                promise = result;
                // Use 'fulfilled' or 'rejected' handlers instead of 'finally' to ensure
                // aspect boundary is consistent with synchronous invocations and avoid
                // reentrancy issues.
                if ($isFunction(after)) {
                    promise.then(result => after(callback, composer, state))
                           .catch(error => after(callback, composer, state));
                }
            }
        }
        return handled;
    } finally {
        if (!promise && $isFunction(after)) {
            after(callback, composer, state);
        }
    }
}

/**
 * Protocol to participate in batched operations.
 * @class Batching
 * @extends miruken.StrictProtocol
 */
export const Batching = StrictProtocol.extend({
    /**
     * Completes the batching operation.
     * @method complete
     * @param   {miruken.callback.CallbackHandler}  composer  - composition handler
     * @returns {Any} the batching result.
     */                
    complete(composer) {}
});

/**
 * Coordinates batching operations through the protocol
 * {{#crossLink "miruken.callback.Batching"}}{{/crossLink}}.
 * @class Batcher
 * @constructor
 * @param   {miruken.Protocol}  [...protocols]  -  protocols to batch
 * @extends miruken.callback.CompositeCallbackHandler
 * @uses miruken.callback.Batching
 */
const BatchingComplete = Batching.extend();
export const Batcher = CompositeCallbackHandler.extend(BatchingComplete, {
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

CallbackHandler.implement({
    /**
     * Prepares the CallbackHandler for batching.
     * @method $batch
     * @param   {miruken.Protocol}  [...protocols]  -  protocols to batch
     * @returns {miruken.callback.CallbackHandler}  batching callback handler.
     * @for miruken.callback.CallbackHandler
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

/**
 * InvocationOptions flags enum
 * @class InvocationOptions
 * @extends miruken.Flags
 */
export const InvocationOptions = Flags({
    /**
     * @property {number} None
     */
    None: 0,
    /**
     * Delivers invocation to all handlers.  At least one must recognize it.
     * @property {number} Broadcast
     */
    Broadcast: 1 << 0,
    /**
     * Marks invocation as optional.
     * @property {number} BestEffort
     */        
    BestEffort: 1 << 1,
    /**
     * Requires invocation to match conforming protocol.
     * @property {number} Strict
     */                
    Strict: 1 << 2,
    /**
     * Uses Resolve to determine instances to invoke.
     * @property {number} Resolve
     */
    Resolve: 1 << 3,
    /**
     * Publishes invocation to all handlers.
     * @property {number} Notify
     */                
    Notify: (1 << 0) | (1 << 1)
});

/**
 * Captures invocation semantics.
 * @class InvocationSemantics
 * @constructor
 * @param  {miruken.callback.InvocationOptions}  options  -  invocation options.
 * @extends Base
 */
export const InvocationSemantics = Composition.extend({
    constructor(options) {
        let _options   = InvocationOptions.None.addFlag(options),
            _specified = _options;
        this.extend({
            /**
             * Gets the invocation option.
             * @method getOption
             * @param   {miruken.callback.InvocationOption} option  -  option to test
             * @returns {boolean} true if invocation option enabled, false otherwise.
             */
            getOption(option) {
                return _options.hasFlag(option);
            },
            /**
             * Sets the invocation option.
             * @method setOption
             * @param   {miruken.callback.InvocationOption} option  -  option to set
             * @param   {boolean}  enabled  -  true if enable option, false to clear.
             */                
            setOption(option, enabled) {
                _options = enabled
                         ? _options.addFlag(option)
                         : _options.removeFlag(option);
                _specified = _specified.addFlag(option);
            },
            /**
             * Determines if the invocation option was specified.
             * @method getOption
             * @param   {miruken.callback.InvocationOption} option  -  option to test
             * @returns {boolean} true if invocation option specified, false otherwise.
             */                
            isSpecified(option) {
                return _specified.hasFlag(option);
            }
        });
    },
    /**
     * Merges invocation options into the supplied constraints. 
     * @method mergeInto
     * @param   {miruken.callback.InvocationSemantics}  semantics  -  receives invocation semantics
     */                
    mergeInto(semantics) {
        const items = InvocationOptions.items;
        for (let i = 0; i < items.length; ++i) {
            const option = +items[i];
            if (this.isSpecified(option) && !semantics.isSpecified(option)) {
                semantics.setOption(option, this.getOption(option));
            }
        }
    }
});

/**
 * Delegates properties and methods to a callback handler using 
 * {{#crossLink "miruken.callback.HandleMethod"}}{{/crossLink}}.
 * @class InvocationDelegate
 * @constructor
 * @param   {miruken.callback.CallbackHandler}  handler  -  forwarding handler 
 * @extends miruken.Delegate
 */
export const InvocationDelegate = Delegate.extend({
    constructor(handler) {
        this.extend({
            get handler() { return handler; }
        });
    },
    get(protocol, propertyName, strict) {
        return delegate(this, HandleMethod.Get, protocol, propertyName, null, strict);
    },
    set(protocol, propertyName, propertyValue, strict) {
        return delegate(this, HandleMethod.Set, protocol, propertyName, propertyValue, strict);
    },
    invoke(protocol, methodName, args, strict) {
        return delegate(this, HandleMethod.Invoke, protocol, methodName, args, strict);
    }
});

function delegate(delegate, type, protocol, methodName, args, strict) {
    let broadcast  = false,
        useResolve = false,
        bestEffort = false,
        handler    = delegate.handler;

    if (!handler.isCompositionScope) {
        const semantics = new InvocationSemantics();
        if (handler.handle(semantics, true)) {
            strict     = !!(strict | semantics.getOption(InvocationOptions.Strict));
            broadcast  = semantics.getOption(InvocationOptions.Broadcast);
            bestEffort = semantics.getOption(InvocationOptions.BestEffort);
            useResolve = semantics.getOption(InvocationOptions.Resolve)
                || protocol.conformsTo(Resolving);
        }
    }
    const handleMethod = useResolve
        ? new ResolveMethod(type, protocol, methodName, args, strict, broadcast, !bestEffort)
        : new HandleMethod(type, protocol, methodName, args, strict);
    if (!handler.handle(handleMethod, broadcast && !useResolve) && !bestEffort) {
        throw new TypeError(`Object ${handler} has no method '${methodName}'`);
    }
    return handleMethod.returnValue;
}

CallbackHandler.implement({
    /**
     * Converts the callback handler to a {{#crossLink "miruken.Delegate"}}{{/crossLink}}.
     * @method toDelegate
     * @returns {miruken.callback.InvocationDelegate}  delegate for this callback handler.
     */            
    toDelegate() { return new InvocationDelegate(this); },
    /**
     * Establishes strict invocation semantics.
     * @method $strict
     * @returns {miruken.callback.CallbackHandler} strict semantics.
     * @for miruken.callback.CallbackHandler
     */
    $strict() { return this.$callOptions(InvocationOptions.Strict); },
    /**
     * Establishes broadcast invocation semantics.
     * @method $broadcast
     * @returns {miruken.callback.CallbackHandler} broadcast semanics.
     * @for miruken.callback.CallbackHandler
     */        
    $broadcast() { return this.$callOptions(InvocationOptions.Broadcast); },
    /**
     * Establishes best-effort invocation semantics.
     * @method $bestEffort
     * @returns {miruken.callback.CallbackHandler} best-effort semanics.
     * @for miruken.callback.CallbackHandler
     */                
    $bestEffort() { return this.$callOptions(InvocationOptions.BestEffort); },
    /**
     * Establishes notification invocation semantics.
     * @method $notify
     * @returns {miruken.callback.InvocationOptionsHandler} notification semanics.
     * @for miruken.callback.CallbackHandler
     */
    $notify() { return this.$callOptions(InvocationOptions.Notify); },
    /**
     * Establishes resolve invocation semantics.
     * @method $resolve
     * @returns {miruken.callback.CallbackHandler} resolved semantics.
     * @for miruken.callback.CallbackHandler
     */
    $resolve() { return this.$callOptions(InvocationOptions.Resolve); },        
    /**
     * Establishes custom invocation semantics.
     * @method $callOptions
     * @param  {miruken.callback.InvocationOptions}  options  -  invocation semantics
     * @returns {miruken.callback.CallbackHandler} custom invocation semanics.
     * @for miruken.callback.CallbackHandler
     */                        
    $callOptions(options) {
        const semantics = new InvocationSemantics(options);
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                let handled = false;
                if (callback instanceof InvocationSemantics) {
                    semantics.mergeInto(callback);
                    handled = true;
                } else if (!greedy) {
                    // Greedy must be false when resolving since Resolution.isMany
                    // represents greedy in that case
                    if (semantics.isSpecified(
                        InvocationOptions.Broadcast | InvocationOptions.Resolve)) {
                        greedy = semantics.getOption(InvocationOptions.Broadcast)
                            && !semantics.getOption(InvocationOptions.Resolve);
                    } else {
                        const inv = new InvocationSemantics();
                        if (this.handle(inv, true) &&
                            inv.isSpecified(InvocationOptions.Broadcast)) {
                            greedy = inv.getOption(InvocationOptions.Broadcast)
                                && !inv.getOption(InvocationOptions.Resolve);
                        }
                    }
                }
                if (greedy || !handled) {
                    handled = handled | this.base(callback, greedy, composer);
                }
                return !!handled;
            }
        });
    }    
});
