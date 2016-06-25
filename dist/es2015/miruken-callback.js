'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InvocationDelegate = exports.InvocationSemantics = exports.InvocationOptions = exports.Batcher = exports.Batching = exports.CompositeCallbackHandler = exports.CascadeCallbackHandler = exports.CallbackHandler = exports.Composition = exports.Resolution = exports.Deferred = exports.Lookup = exports.ResolveMethod = exports.HandleMethod = exports.$composer = exports.$callbacks = exports.$NOT_HANDLED = exports.$lookup = exports.$provide = exports.$handle = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.$define = $define;
exports.Node = Node;
exports.RejectedError = RejectedError;
exports.TimeoutError = TimeoutError;

var _mirukenCore = require('miruken-core');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var _definitions = {};

var $handle = exports.$handle = $define('$handle', _mirukenCore.Variance.Contravariant);
var $provide = exports.$provide = $define('$provide', _mirukenCore.Variance.Covariant);
var $lookup = exports.$lookup = $define('$lookup', _mirukenCore.Variance.Invariant);
var $NOT_HANDLED = exports.$NOT_HANDLED = Object.freeze({});

var $callbacks = exports.$callbacks = _mirukenCore.MetaMacro.extend({
    execute: function execute(step, metadata, target, definition) {
        if ((0, _mirukenCore.$isNothing)(definition)) {
            return;
        }
        var source = target,
            type = metadata.type;
        if (target === type.prototype) {
            target = type;
        }
        for (var tag in _definitions) {
            var list = this.extractProperty(tag, source, definition);
            if (!list || list.length == 0) {
                continue;
            }
            var define = _definitions[tag];
            for (var idx = 0; idx < list.length; ++idx) {
                var constraint = list[idx];
                if (++idx >= list.length) {
                    throw new Error('Incomplete ' + tag + ' definition: missing handler for constraint ' + constraint + '.');
                }
                define(target, constraint, list[idx]);
            }
        }
    },

    shouldInherit: _mirukenCore.True,

    isActive: _mirukenCore.True
});

function $define(tag, variance) {
    if (!(0, _mirukenCore.$isString)(tag) || tag.length === 0 || /\s/.test(tag)) {
        throw new TypeError("The tag must be a non-empty string with no whitespace.");
    } else if (_definitions[tag]) {
        throw new TypeError('\'' + tag + '\' is already defined.');
    }

    var handled = void 0,
        comparer = void 0;
    variance = variance || _mirukenCore.Variance.Contravariant;
    if (!(variance instanceof _mirukenCore.Variance)) {
        throw new TypeError("Invalid variance type supplied");
    }
    switch (variance) {
        case _mirukenCore.Variance.Covariant:
            handled = _requiresResult;
            comparer = _compareCovariant;
            break;
        case _mirukenCore.Variance.Contravariant:
            handled = _impliesSuccess;
            comparer = _compareContravariant;
            break;
        case _mirukenCore.Variance.Invariant:
            handled = _requiresResult;
            comparer = _compareInvariant;
            break;
    }

    function definition(owner, constraint, handler, removed) {
        if (Array.isArray(constraint)) {
            return constraint.reduce(function (result, c) {
                var undefine = _definition(owner, c, handler, removed);
                return function (notifyRemoved) {
                    result(notifyRemoved);
                    undefine(notifyRemoved);
                };
            }, _mirukenCore.Undefined);
        }
        return _definition(owner, constraint, handler, removed);
    }
    function _definition(owner, constraint, handler, removed) {
        if ((0, _mirukenCore.$isNothing)(owner)) {
            throw new TypeError("Definitions must have an owner.");
        } else if ((0, _mirukenCore.$isNothing)(handler)) {
            handler = constraint;
            constraint = (0, _mirukenCore.$classOf)(_mirukenCore.Modifier.unwrap(constraint));
        }
        if ((0, _mirukenCore.$isNothing)(handler)) {
            throw new TypeError('Incomplete \'' + tag + '\' definition: missing handler for constraint ' + constraint);
        } else if (removed && !(0, _mirukenCore.$isFunction)(removed)) {
            throw new TypeError("The removed argument is not a function.");
        }
        if (!(0, _mirukenCore.$isFunction)(handler)) {
            if (_mirukenCore.$copy.test(handler)) {
                var source = _mirukenCore.Modifier.unwrap(handler);
                if (!(0, _mirukenCore.$isFunction)(source.copy)) {
                    throw new Error("$copy requires the target to have a copy method.");
                }
                handler = source.copy.bind(source);
            } else {
                var _source = _mirukenCore.$use.test(handler) ? _mirukenCore.Modifier.unwrap(handler) : handler;
                handler = (0, _mirukenCore.$lift)(_source);
            }
        }
        var meta = owner[_mirukenCore.Metadata],
            node = new Node(constraint, handler, removed),
            index = _createIndex(node.constraint),
            list = meta[tag] || (meta[tag] = new _mirukenCore.IndexedList(comparer));
        list.insert(node, index);
        return function (notifyRemoved) {
            list.remove(node);
            if (list.isEmpty()) {
                delete meta[tag];
            }
            if (node.removed && notifyRemoved !== false) {
                node.removed(owner);
            }
        };
    };
    definition.removeAll = function (owner) {
        var meta = owner[_mirukenCore.Metadata],
            list = meta[tag];
        var head = list.head;
        while (head) {
            if (head.removed) {
                head.removed(owner);
            }
            head = head.next;
        }
        delete meta[tag];
    };
    definition.dispatch = function (handler, callback, constraint, composer, all, results) {
        var v = variance;
        var delegate = handler.delegate;
        constraint = constraint || callback;
        if (constraint) {
            if (_mirukenCore.$eq.test(constraint)) {
                v = _mirukenCore.Variance.Invariant;
            }
            constraint = _mirukenCore.Modifier.unwrap(constraint);
            if ((0, _mirukenCore.typeOf)(constraint) === 'object') {
                constraint = (0, _mirukenCore.$classOf)(constraint);
            }
        }
        var ok = delegate && _dispatch(delegate, delegate[_mirukenCore.Metadata], callback, constraint, v, composer, all, results);
        if (!ok || all) {
            ok = ok || _dispatch(handler, handler[_mirukenCore.Metadata], callback, constraint, v, composer, all, results);
        }
        return ok;
    };
    function _dispatch(target, meta, callback, constraint, v, composer, all, results) {
        var dispatched = false;
        var invariant = v === _mirukenCore.Variance.Invariant,
            index = meta && _createIndex(constraint);
        while (meta) {
            var list = meta[tag];
            if (list && (!invariant || index)) {
                var node = list.getIndex(index) || list.head;
                while (node) {
                    if (node.match(constraint, v)) {
                        var base = target.base;
                        var baseCalled = false;
                        target.base = function () {
                            var baseResult = void 0;
                            baseCalled = true;
                            _dispatch(target, meta.parent, callback, constraint, v, composer, false, function (result) {
                                baseResult = result;
                            });
                            return baseResult;
                        };
                        try {
                            var result = node.handler.call(target, callback, composer);
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
                        break;
                    }
                    node = node.next;
                }
            }
            meta = meta.parent;
        }
        return dispatched;
    }
    _definitions[tag] = definition;
    return definition;
}

function Node(constraint, handler, removed) {
    var invariant = _mirukenCore.$eq.test(constraint);
    constraint = _mirukenCore.Modifier.unwrap(constraint);
    this.constraint = constraint;
    this.handler = handler;
    if ((0, _mirukenCore.$isNothing)(constraint)) {
        this.match = invariant ? _mirukenCore.False : _matchEverything;
    } else if ((0, _mirukenCore.$isProtocol)(constraint)) {
        this.match = invariant ? _matchInvariant : _matchProtocol;
    } else if ((0, _mirukenCore.$isClass)(constraint)) {
        this.match = invariant ? _matchInvariant : _matchClass;
    } else if ((0, _mirukenCore.$isString)(constraint)) {
        this.match = _matchString;
    } else if (constraint instanceof RegExp) {
        this.match = invariant ? _mirukenCore.False : _matchRegExp;
    } else if ((0, _mirukenCore.$isFunction)(constraint)) {
        this.match = constraint;
    } else {
        this.match = _mirukenCore.False;
    }
    if (removed) {
        this.removed = removed;
    }
}

function _createIndex(constraint) {
    if (constraint) {
        if ((0, _mirukenCore.$isString)(constraint)) {
            return constraint;
        } else if ((0, _mirukenCore.$isFunction)(constraint)) {
            return (0, _mirukenCore.assignID)(constraint);
        }
    }
}

function _matchInvariant(match) {
    return this.constraint === match;
}

function _matchEverything(match, variance) {
    return variance !== _mirukenCore.Variance.Invariant;
}

function _matchProtocol(match, variance) {
    var constraint = this.constraint;
    if (constraint === match) {
        return true;
    } else if (variance === _mirukenCore.Variance.Covariant) {
        return constraint.conformsTo(match);
    } else if (variance === _mirukenCore.Variance.Contravariant) {
        return match.conformsTo && match.conformsTo(constraint);
    }
    return false;
}

function _matchClass(match, variance) {
    var constraint = this.constraint;
    if (constraint === match) {
        return true;
    } else if (variance === _mirukenCore.Variance.Contravariant) {
        return match.prototype instanceof constraint;
    } else if (variance === _mirukenCore.Variance.Covariant) {
        return match.prototype && (constraint.prototype instanceof match || (0, _mirukenCore.$isProtocol)(match) && match.adoptedBy(constraint));
    }
    return false;
}

function _matchString(match) {
    return (0, _mirukenCore.$isString)(match) && this.constraint == match;
}

function _matchRegExp(match, variance) {
    return variance !== _mirukenCore.Variance.Invariant && this.constraint.test(match);
}

function _compareCovariant(node, insert) {
    if (insert.match(node.constraint, _mirukenCore.Variance.Invariant)) {
        return 0;
    } else if (insert.match(node.constraint, _mirukenCore.Variance.Covariant)) {
        return -1;
    }
    return 1;
}

function _compareContravariant(node, insert) {
    if (insert.match(node.constraint, _mirukenCore.Variance.Invariant)) {
        return 0;
    } else if (insert.match(node.constraint, _mirukenCore.Variance.Contravariant)) {
        return -1;
    }
    return 1;
}

function _compareInvariant(node, insert) {
    return insert.match(node.constraint, _mirukenCore.Variance.Invariant) ? 0 : -1;
}

function _requiresResult(result) {
    return result !== null && result !== undefined && result !== $NOT_HANDLED;
}

function _impliesSuccess(result) {
    return result ? result !== $NOT_HANDLED : result === undefined;
}

var $composer = exports.$composer = void 0;

var HandleMethod = exports.HandleMethod = _mirukenCore.Base.extend({
    constructor: function constructor(type, protocol, methodName, args, strict) {
        if (protocol && !(0, _mirukenCore.$isProtocol)(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        var _returnValue = void 0,
            _exception = void 0;
        this.extend({
            get type() {
                return type;
            },

            get protocol() {
                return protocol;
            },

            get methodName() {
                return methodName;
            },

            get arguments() {
                return args;
            },

            get returnValue() {
                return _returnValue;
            },
            set returnValue(value) {
                _returnValue = value;
            },

            get exception() {
                return _exception;
            },
            set exception(exception) {
                _exception = exception;
            },

            get callbackResult() {
                return _returnValue;
            },
            set callbackResult(value) {
                _returnValue = value;
            },
            invokeOn: function invokeOn(target, composer) {
                if (!target || strict && protocol && !protocol.adoptedBy(target)) {
                    return false;
                }
                var method = void 0,
                    result = void 0;
                if (type === HandleMethod.Invoke) {
                    method = target[methodName];
                    if (!(0, _mirukenCore.$isFunction)(method)) {
                        return false;
                    }
                }
                var oldComposer = $composer;
                try {
                    exports.$composer = $composer = composer;
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
                    exports.$composer = $composer = oldComposer;
                }
            }
        });
    }
}, {
    Get: 1,

    Set: 2,

    Invoke: 3
});

var ResolveMethod = exports.ResolveMethod = HandleMethod.extend({
    constructor: function constructor(type, protocol, methodName, args, strict, all, required) {
        this.base(type, protocol, methodName, args, strict);
        this.extend({
            invokeResolve: function invokeResolve(composer) {
                var _this = this;

                var handled = false,
                    targets = composer.resolveAll(protocol);

                if ((0, _mirukenCore.$isPromise)(targets)) {
                    this.returnValue = new Promise(function (resolve, reject) {
                        targets.then(function (targets) {
                            invokeTargets.call(_this, targets);
                            if (_this.execption) {
                                reject(_this.exeception);
                            } else if (handled) {
                                resolve(_this.returnValue);
                            } else if (required) {
                                reject(new TypeError('Object ' + composer + ' has no method \'' + methodName + '\''));
                            } else {
                                resolve();
                            }
                        }, reject);
                    });
                    return true;
                }

                invokeTargets.call(this, targets);

                function invokeTargets(targets) {
                    for (var i = 0; i < targets.length; ++i) {
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

var Lookup = exports.Lookup = _mirukenCore.Base.extend({
    constructor: function constructor(key, many) {
        if ((0, _mirukenCore.$isNothing)(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        var _results = [],
            _result = void 0,
            _instant = _mirukenCore.$instant.test(key);
        this.extend({
            get key() {
                return key;
            },

            get isMany() {
                return many;
            },

            get results() {
                return _results;
            },

            get callbackResult() {
                if (_result === undefined) {
                    if (!many) {
                        if (_results.length > 0) {
                            _result = _results[0];
                        }
                    } else if (_instant) {
                        _result = (0, _mirukenCore.$flatten)(_results);
                    } else {
                        _result = Promise.all(_results).then(_mirukenCore.$flatten);
                    }
                }
                return _result;
            },
            set callbackResult(value) {
                _result = value;
            },
            addResult: function addResult(result) {
                if ((many || _results.length === 0) && !(_instant && (0, _mirukenCore.$isPromise)(result))) {
                    _results.push(result);
                    _result = undefined;
                }
            }
        });
    }
});

var Deferred = exports.Deferred = _mirukenCore.Base.extend({
    constructor: function constructor(callback, many) {
        if ((0, _mirukenCore.$isNothing)(callback)) {
            throw new TypeError("The callback is required.");
        }
        many = !!many;
        var _pending = [],
            _tracked = void 0,
            _result = void 0;
        this.extend({
            get isMany() {
                return many;
            },

            get callback() {
                return callback;
            },

            get pending() {
                return _pending;
            },

            get callbackResult() {
                if (_result === undefined) {
                    if (_pending.length === 1) {
                        _result = Promise.resolve(_pending[0]).then(_mirukenCore.True);
                    } else if (_pending.length > 1) {
                        _result = Promise.all(_pending).then(_mirukenCore.True);
                    } else {
                        _result = Promise.resolve(_tracked);
                    }
                }
                return _result;
            },
            set callbackResult(value) {
                _result = value;
            },
            track: function track(promise) {
                if ((many || _pending.length === 0) && (0, _mirukenCore.$isPromise)(promise)) {
                    _pending.push(promise);
                    _result = undefined;
                }
                if (!_tracked) {
                    _tracked = true;
                    _result = undefined;
                }
            }
        });
    }
});

var Resolution = exports.Resolution = _mirukenCore.Base.extend({
    constructor: function constructor(key, many) {
        if ((0, _mirukenCore.$isNothing)(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        var _resolutions = [],
            _promised = false,
            _result = void 0,
            _instant = _mirukenCore.$instant.test(key);
        this.extend({
            get key() {
                return key;
            },

            get isMany() {
                return many;
            },

            get instant() {
                return !_promised;
            },

            get resolutions() {
                return _resolutions;
            },

            get callbackResult() {
                if (_result === undefined) {
                    if (!many) {
                        var resolutions = (0, _mirukenCore.$flatten)(_resolutions, true);
                        if (resolutions.length > 0) {
                            _result = resolutions[0];
                        }
                    } else {
                        _result = this.instant ? (0, _mirukenCore.$flatten)(_resolutions, true) : Promise.all(_resolutions).then(function (res) {
                            return (0, _mirukenCore.$flatten)(res, true);
                        });
                    }
                }
                return _result;
            },
            set callbackResult(value) {
                _result = value;
            },
            resolve: function resolve(resolution) {
                if (!many && _resolutions.length > 0) {
                    return;
                }
                var promised = (0, _mirukenCore.$isPromise)(resolution);
                if (!_instant || !promised) {
                    _promised = _promised || promised;
                    if (promised && many) {
                        resolution = resolution.catch(_mirukenCore.Undefined);
                    }
                    _resolutions.push(resolution);
                    _result = undefined;
                }
            }
        });
    }
});

var Composition = exports.Composition = _mirukenCore.Base.extend({
    constructor: function constructor(callback) {
        if (callback) {
            this.extend({
                get callback() {
                    return callback;
                },

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

function RejectedError(callback) {
    this.callback = callback;

    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Error.call(this);
    }
}
RejectedError.prototype = new Error();
RejectedError.prototype.constructor = RejectedError;

function TimeoutError(callback, message) {
    this.callback = callback;

    this.message = message || "Timeout occurred";

    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Error.call(this);
    }
}
TimeoutError.prototype = new Error();
TimeoutError.prototype.constructor = TimeoutError;

var CallbackHandler = exports.CallbackHandler = _mirukenCore.Base.extend($callbacks, {
    constructor: function constructor(delegate) {
        this.extend({
            get delegate() {
                return delegate;
            }
        });
    },
    handle: function handle(callback, greedy, composer) {
        if ((0, _mirukenCore.$isNothing)(callback)) {
            return false;
        }
        if ((0, _mirukenCore.$isNothing)(composer)) {
            composer = compositionScope(this);
        }
        return !!this.handleCallback(callback, !!greedy, composer);
    },
    handleCallback: function handleCallback(callback, greedy, composer) {
        return $handle.dispatch(this, callback, null, composer, greedy);
    },

    $handle: [Lookup, function (lookup, composer) {
        return $lookup.dispatch(this, lookup, lookup.key, composer, lookup.isMany, lookup.addResult);
    }, Deferred, function (deferred, composer) {
        return $handle.dispatch(this, deferred.callback, null, composer, deferred.isMany, deferred.track);
    }, Resolution, function (resolution, composer) {
        var key = resolution.key,
            many = resolution.isMany;
        var resolved = $provide.dispatch(this, resolution, key, composer, many, resolution.resolve);
        if (!resolved) {
            var implied = new Node(key),
                delegate = this.delegate;
            if (delegate && implied.match((0, _mirukenCore.$classOf)(delegate), _mirukenCore.Variance.Contravariant)) {
                resolution.resolve((0, _mirukenCore.$decorated)(delegate, true));
                resolved = true;
            }
            if ((!resolved || many) && implied.match((0, _mirukenCore.$classOf)(this), _mirukenCore.Variance.Contravariant)) {
                resolution.resolve((0, _mirukenCore.$decorated)(this, true));
                resolved = true;
            }
        }
        return resolved;
    }, HandleMethod, function (method, composer) {
        return method.invokeOn(this.delegate, composer) || method.invokeOn(this, composer);
    }, ResolveMethod, function (method, composer) {
        return method.invokeResolve(composer);
    }, Composition, function (composable, composer) {
        var callback = composable.callback;
        return callback && $handle.dispatch(this, callback, null, composer);
    }]
}, {
    coerce: function coerce(object) {
        return new this(object);
    }
});

_mirukenCore.Base.implement({
    toCallbackHandler: function toCallbackHandler() {
        return CallbackHandler(this);
    }
});

var compositionScope = (0, _mirukenCore.$decorator)({
    isCompositionScope: function isCompositionScope() {
        return true;
    },
    handleCallback: function handleCallback(callback, greedy, composer) {
        if (!(callback instanceof Composition)) {
            callback = new Composition(callback);
        }
        return this.base(callback, greedy, composer);
    }
});

var CascadeCallbackHandler = exports.CascadeCallbackHandler = CallbackHandler.extend({
    constructor: function constructor(handler, cascadeToHandler) {
        if ((0, _mirukenCore.$isNothing)(handler)) {
            throw new TypeError("No handler specified.");
        } else if ((0, _mirukenCore.$isNothing)(cascadeToHandler)) {
            throw new TypeError("No cascadeToHandler specified.");
        }
        handler = handler.toCallbackHandler();
        cascadeToHandler = cascadeToHandler.toCallbackHandler();
        this.extend({
            get handler() {
                return handler;
            },

            get cascadeToHandler() {
                return cascadeToHandler;
            }
        });
    },
    handleCallback: function handleCallback(callback, greedy, composer) {
        var handled = greedy ? this.handler.handleCallback(callback, true, composer) | this.cascadeToHandler.handleCallback(callback, true, composer) : this.handler.handleCallback(callback, false, composer) || this.cascadeToHandler.handleCallback(callback, false, composer);
        if (!handled || greedy) {
            handled = this.base(callback, greedy, composer) || handled;
        }
        return !!handled;
    }
});

var CompositeCallbackHandler = exports.CompositeCallbackHandler = CallbackHandler.extend({
    constructor: function constructor() {
        for (var _len = arguments.length, handlers = Array(_len), _key = 0; _key < _len; _key++) {
            handlers[_key] = arguments[_key];
        }

        var _handlers = [];
        this.extend({
            getHandlers: function getHandlers() {
                return _handlers.slice();
            },
            addHandlers: function addHandlers() {
                for (var _len2 = arguments.length, handlers = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                    handlers[_key2] = arguments[_key2];
                }

                handlers = (0, _mirukenCore.$flatten)(handlers, true).map(function (h) {
                    return h.toCallbackHandler();
                });
                _handlers.push.apply(_handlers, _toConsumableArray(handlers));
                return this;
            },
            insertHandlers: function insertHandlers(atIndex) {
                for (var _len3 = arguments.length, handlers = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                    handlers[_key3 - 1] = arguments[_key3];
                }

                handlers = (0, _mirukenCore.$flatten)(handlers, true).map(function (h) {
                    return h.toCallbackHandler();
                });
                _handlers.splice.apply(_handlers, [atIndex].concat(_toConsumableArray(handlers)));
                return this;
            },
            removeHandlers: function removeHandlers() {
                for (var _len4 = arguments.length, handlers = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                    handlers[_key4] = arguments[_key4];
                }

                (0, _mirukenCore.$flatten)(handlers).forEach(function (handler) {
                    if (!handler) {
                        return;
                    }
                    var count = _handlers.length;
                    for (var idx = 0; idx < count; ++idx) {
                        var testHandler = _handlers[idx];
                        if (testHandler == handler || testHandler.delegate == handler) {
                            _handlers.removeAt(idx);
                            return;
                        }
                    }
                });
                return this;
            },
            handleCallback: function handleCallback(callback, greedy, composer) {
                var handled = false,
                    count = _handlers.length;
                for (var idx = 0; idx < count; ++idx) {
                    var handler = _handlers[idx];
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

CallbackHandler.accepting = function (handler, constraint) {
    var accepting = new CallbackHandler();
    $handle(accepting, constraint, handler);
    return accepting;
};

CallbackHandler.providing = function (provider, constraint) {
    var providing = new CallbackHandler();
    $provide(providing, constraint, provider);
    return providing;
};

CallbackHandler.implementing = function (methodName, method) {
    if (!(0, _mirukenCore.$isString)(methodName) || methodName.length === 0 || !methodName.trim()) {
        throw new TypeError("No methodName specified.");
    } else if (!(0, _mirukenCore.$isFunction)(method)) {
        throw new TypeError('Invalid method: ' + method + ' is not a function.');
    }
    return new CallbackHandler().extend({
        handleCallback: function handleCallback(callback, greedy, composer) {
            if (callback instanceof HandleMethod) {
                var target = new Object();
                target[methodName] = method;
                return callback.invokeOn(target);
            }
            return false;
        }
    });
};

CallbackHandler.implement({
    defer: function defer(callback) {
        var deferred = new Deferred(callback);
        this.handle(deferred, false, $composer);
        return deferred.callbackResult;
    },
    deferAll: function deferAll(callback) {
        var deferred = new Deferred(callback, true);
        this.handle(deferred, true, $composer);
        return deferred.callbackResult;
    },
    resolve: function resolve(key) {
        var resolution = key instanceof Resolution ? key : new Resolution(key);
        if (this.handle(resolution, false, $composer)) {
            return resolution.callbackResult;
        }
    },
    resolveAll: function resolveAll(key) {
        var resolution = key instanceof Resolution ? key : new Resolution(key, true);
        return this.handle(resolution, true, $composer) ? resolution.callbackResult : [];
    },
    lookup: function lookup(key) {
        var lookup = key instanceof Lookup ? key : new Lookup(key);
        if (this.handle(lookup, false, $composer)) {
            return lookup.callbackResult;
        }
    },
    lookupAll: function lookupAll(key) {
        var lookup = key instanceof Lookup ? key : new Lookup(key, true);
        return this.handle(lookup, true, $composer) ? lookup.callbackResult : [];
    },
    decorate: function decorate(decorations) {
        return (0, _mirukenCore.$decorate)(this, decorations);
    },
    filter: function filter(_filter, reentrant) {
        if (!(0, _mirukenCore.$isFunction)(_filter)) {
            throw new TypeError('Invalid filter: ' + _filter + ' is not a function.');
        }
        return this.decorate({
            handleCallback: function handleCallback(callback, greedy, composer) {
                var _this2 = this;

                if (!reentrant && callback instanceof Composition) {
                    return this.base(callback, greedy, composer);
                }
                var base = this.base;
                return _filter(callback, composer, function () {
                    return base.call(_this2, callback, greedy, composer);
                });
            }
        });
    },
    aspect: function aspect(before, after, reentrant) {
        return this.filter(function (callback, composer, proceed) {
            if ((0, _mirukenCore.$isFunction)(before)) {
                var test = before(callback, composer);
                if ((0, _mirukenCore.$isPromise)(test)) {
                    var _ret = function () {
                        var hasResult = "callbackResult" in callback,
                            accept = test.then(function (accepted) {
                            if (accepted !== false) {
                                _aspectProceed(callback, composer, proceed, after, accepted);
                                return hasResult ? callback.callbackResult : true;
                            }
                            return Promise.reject(new RejectedError(callback));
                        });
                        if (hasResult) {
                            callback.callbackResult = accept;
                        }
                        return {
                            v: true
                        };
                    }();

                    if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
                } else if (test === false) {
                    throw new RejectedError(callback);
                }
            }
            return _aspectProceed(callback, composer, proceed, after);
        }, reentrant);
    },
    $$handle: function $$handle(definitions) {
        return this.decorate({ $handle: definitions });
    },
    $$provide: function $$provide(definitions) {
        return this.decorate({ $provide: definitions });
    },
    when: function when(constraint) {
        var when = new Node(constraint),
            condition = function condition(callback) {
            if (callback instanceof Deferred) {
                return when.match((0, _mirukenCore.$classOf)(callback.callback), _mirukenCore.Variance.Contravariant);
            } else if (callback instanceof Resolution) {
                return when.match(callback.key, _mirukenCore.Variance.Covariant);
            } else {
                return when.match((0, _mirukenCore.$classOf)(callback), _mirukenCore.Variance.Contravariant);
            }
        };
        return this.decorate({
            handleCallback: function handleCallback(callback, greedy, composer) {
                return condition(callback) && this.base(callback, greedy, composer);
            }
        });
    },
    next: function next() {
        for (var _len5 = arguments.length, handlers = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
            handlers[_key5] = arguments[_key5];
        }

        switch (handlers.length) {
            case 0:
                return this;
            case 1:
                return new CascadeCallbackHandler(this, handlers[0]);
            default:
                return new (Function.prototype.bind.apply(CompositeCallbackHandler, [null].concat([this], handlers)))();
        }
    },
    $guard: function $guard(target, property) {
        var _this3 = this;

        if (target) {
            var _ret2 = function () {
                var guarded = false;
                property = property || "guarded";
                var propExists = property in target;
                return {
                    v: _this3.aspect(function () {
                        if (guarded = target[property]) {
                            return false;
                        }
                        target[property] = true;
                        return true;
                    }, function () {
                        if (!guarded) {
                            target[property] = undefined;
                            if (!propExists) {
                                delete target[property];
                            }
                        }
                    })
                };
            }();

            if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
        }
        return this;
    },
    $activity: function $activity(target, ms, property) {
        property = property || "$$activity";
        var propExists = property in target;
        return this.aspect(function () {
            var state = { enabled: false };
            setTimeout(function () {
                if ("enabled" in state) {
                    state.enabled = true;
                    var activity = target[property] || 0;
                    target[property] = ++activity;
                }
            }, $isSomething(ms) ? ms : 50);
            return state;
        }, function (_, composer, state) {
            if (state.enabled) {
                var activity = target[property];
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
    $promise: function $promise() {
        return this.filter(function (callback, composer, proceed) {
            try {
                var handled = proceed();
                if (handled) {
                    var result = callback.callbackResult;
                    callback.callbackResult = (0, _mirukenCore.$isPromise)(result) ? result : Promise.resolve(result);
                }
                return handled;
            } catch (ex) {
                callback.callbackResult = Promise.reject(ex);
                return true;
            }
        });
    },
    $timeout: function $timeout(ms, error) {
        return this.filter(function (callback, composer, proceed) {
            var handled = proceed();
            if (handled) {
                (function () {
                    var result = callback.callbackResult;
                    if ((0, _mirukenCore.$isPromise)(result)) {
                        callback.callbackResult = new Promise(function (resolve, reject) {
                            var timeout = void 0;
                            result.then(function (res) {
                                if (timeout) {
                                    clearTimeout(timeout);
                                }
                                resolve(res);
                            }, function (err) {
                                if (timeout) {
                                    clearTimeout(timeout);
                                }
                                reject(err);
                            });
                            timeout = setTimeout(function () {
                                if (!error) {
                                    error = new TimeoutError(callback);
                                } else if ((0, _mirukenCore.$isFunction)(error)) {
                                    error = Reflect.construct(error, [callback]);
                                }
                                if ((0, _mirukenCore.$isFunction)(result.reject)) {
                                    result.reject(error);
                                }
                                reject(error);
                            }, ms);
                        });
                    }
                })();
            }
            return handled;
        });
    }
});

function _aspectProceed(callback, composer, proceed, after, state) {
    var promise = void 0;
    try {
        var handled = proceed();
        if (handled) {
            var result = callback.callbackResult;
            if ((0, _mirukenCore.$isPromise)(result)) {
                promise = result;

                if ((0, _mirukenCore.$isFunction)(after)) {
                    promise.then(function (result) {
                        return after(callback, composer, state);
                    }).catch(function (error) {
                        return after(callback, composer, state);
                    });
                }
            }
        }
        return handled;
    } finally {
        if (!promise && (0, _mirukenCore.$isFunction)(after)) {
            after(callback, composer, state);
        }
    }
}

var Batching = exports.Batching = _mirukenCore.StrictProtocol.extend({
    complete: function complete(composer) {}
});

var BatchingComplete = Batching.extend();
var Batcher = exports.Batcher = CompositeCallbackHandler.extend(BatchingComplete, {
    constructor: function constructor() {
        for (var _len6 = arguments.length, protocols = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
            protocols[_key6] = arguments[_key6];
        }

        this.base();
        protocols = (0, _mirukenCore.$flatten)(protocols, true);
        this.extend({
            shouldBatch: function shouldBatch(protocol) {
                return protocol && (protocols.length == 0 || protocols.indexOf(protocol) >= 0);
            }
        });
    },
    complete: function complete(composer) {
        var promise = false,
            results = this.getHandlers().reduce(function (res, handler) {
            var result = Batching(handler).complete(composer);
            if (result) {
                promise = promise || (0, _mirukenCore.$isPromise)(result);
                res.push(result);
                return res;
            }
        }, []);
        return promise ? Promise.all(results) : results;
    }
});

CallbackHandler.implement({
    $batch: function $batch(protocols) {
        var _batcher = new Batcher(protocols),
            _complete = false,
            _promises = [];
        return this.decorate({
            $provide: [Batcher, function () {
                return _batcher;
            }],
            handleCallback: function handleCallback(callback, greedy, composer) {
                var handled = false;
                if (_batcher) {
                    var b = _batcher;
                    if (_complete && !(callback instanceof Composition)) {
                        _batcher = null;
                    }
                    if ((handled = b.handleCallback(callback, greedy, composer)) && !greedy) {
                        if (_batcher) {
                            var result = callback.callbackResult;
                            if ((0, _mirukenCore.$isPromise)(result)) {
                                _promises.push(result);
                            }
                        }
                        return true;
                    }
                }
                return this.base(callback, greedy, composer) || handled;
            },
            dispose: function dispose() {
                _complete = true;
                var results = BatchingComplete(this).complete(this);
                return _promises.length > 0 ? Promise.all(_promises).then(function () {
                    return results;
                }) : results;
            }
        });
    },
    getBatcher: function getBatcher(protocol) {
        var batcher = this.resolve(Batcher);
        if (batcher && (!protocol || batcher.shouldBatch(protocol))) {
            return batcher;
        }
    }
});

var InvocationOptions = exports.InvocationOptions = (0, _mirukenCore.Flags)({
    None: 0,

    Broadcast: 1 << 0,

    BestEffort: 1 << 1,

    Strict: 1 << 2,

    Resolve: 1 << 3,

    Notify: 1 << 0 | 1 << 1
});

var InvocationSemantics = exports.InvocationSemantics = Composition.extend({
    constructor: function constructor(options) {
        var _options = InvocationOptions.None.addFlag(options),
            _specified = _options;
        this.extend({
            getOption: function getOption(option) {
                return _options.hasFlag(option);
            },
            setOption: function setOption(option, enabled) {
                _options = enabled ? _options.addFlag(option) : _options.removeFlag(option);
                _specified = _specified.addFlag(option);
            },
            isSpecified: function isSpecified(option) {
                return _specified.hasFlag(option);
            }
        });
    },
    mergeInto: function mergeInto(semantics) {
        var items = InvocationOptions.items;
        for (var i = 0; i < items.length; ++i) {
            var option = +items[i];
            if (this.isSpecified(option) && !semantics.isSpecified(option)) {
                semantics.setOption(option, this.getOption(option));
            }
        }
    }
});

var InvocationDelegate = exports.InvocationDelegate = _mirukenCore.Delegate.extend({
    constructor: function constructor(handler) {
        this.extend({
            get handler() {
                return handler;
            }
        });
    },
    get: function get(protocol, propertyName, strict) {
        return _delegateInvocation(this, HandleMethod.Get, protocol, propertyName, null, strict);
    },
    set: function set(protocol, propertyName, propertyValue, strict) {
        return _delegateInvocation(this, HandleMethod.Set, protocol, propertyName, propertyValue, strict);
    },
    invoke: function invoke(protocol, methodName, args, strict) {
        return _delegateInvocation(this, HandleMethod.Invoke, protocol, methodName, args, strict);
    }
});

function _delegateInvocation(delegate, type, protocol, methodName, args, strict) {
    var broadcast = false,
        useResolve = false,
        bestEffort = false,
        handler = delegate.handler;

    if (!handler.isCompositionScope) {
        var semantics = new InvocationSemantics();
        if (handler.handle(semantics, true)) {
            strict = !!(strict | semantics.getOption(InvocationOptions.Strict));
            broadcast = semantics.getOption(InvocationOptions.Broadcast);
            bestEffort = semantics.getOption(InvocationOptions.BestEffort);
            useResolve = semantics.getOption(InvocationOptions.Resolve) || protocol.conformsTo(_mirukenCore.Resolving);
        }
    }
    var handleMethod = useResolve ? new ResolveMethod(type, protocol, methodName, args, strict, broadcast, !bestEffort) : new HandleMethod(type, protocol, methodName, args, strict);
    if (!handler.handle(handleMethod, broadcast && !useResolve) && !bestEffort) {
        throw new TypeError('Object ' + handler + ' has no method \'' + methodName + '\'');
    }
    return handleMethod.returnValue;
}

CallbackHandler.implement({
    toDelegate: function toDelegate() {
        return new InvocationDelegate(this);
    },
    $strict: function $strict() {
        return this.$callOptions(InvocationOptions.Strict);
    },
    $broadcast: function $broadcast() {
        return this.$callOptions(InvocationOptions.Broadcast);
    },
    $bestEffort: function $bestEffort() {
        return this.$callOptions(InvocationOptions.BestEffort);
    },
    $notify: function $notify() {
        return this.$callOptions(InvocationOptions.Notify);
    },
    $resolve: function $resolve() {
        return this.$callOptions(InvocationOptions.Resolve);
    },
    $callOptions: function $callOptions(options) {
        var semantics = new InvocationSemantics(options);
        return this.decorate({
            handleCallback: function handleCallback(callback, greedy, composer) {
                var handled = false;
                if (callback instanceof InvocationSemantics) {
                    semantics.mergeInto(callback);
                    handled = true;
                } else if (!greedy) {
                    if (semantics.isSpecified(InvocationOptions.Broadcast | InvocationOptions.Resolve)) {
                        greedy = semantics.getOption(InvocationOptions.Broadcast) && !semantics.getOption(InvocationOptions.Resolve);
                    } else {
                        var inv = new InvocationSemantics();
                        if (this.handle(inv, true) && inv.isSpecified(InvocationOptions.Broadcast)) {
                            greedy = inv.getOption(InvocationOptions.Broadcast) && !inv.getOption(InvocationOptions.Resolve);
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