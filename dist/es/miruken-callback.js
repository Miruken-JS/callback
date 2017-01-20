import { $classOf, $decorate, $decorator, $eq, $flatten, $instant, $isClass, $isFunction, $isNothing, $isObject, $isPromise, $isProtocol, $isString, $lift, $use, Base, Delegate, False, Flags, IndexedList, Metadata, MethodType, Modifier, Resolving, StrictProtocol, Undefined, Variance, assignID, decorate as decorate$1, isDescriptor } from 'miruken-core';

var Lookup = Base.extend({
    constructor: function constructor(key, many) {
        if ($isNothing(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        var _results = [],
            _result = void 0,
            _instant = $instant.test(key);
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
                        _result = $flatten(_results);
                    } else {
                        _result = Promise.all(_results).then($flatten);
                    }
                }
                return _result;
            },
            set callbackResult(value) {
                _result = value;
            },
            addResult: function addResult(result) {
                if ((many || _results.length === 0) && !(_instant && $isPromise(result))) {
                    _results.push(result);
                    _result = undefined;
                }
            }
        });
    }
});

var Deferred = Base.extend({
    constructor: function constructor(callback, many) {
        if ($isNothing(callback)) {
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
                        _result = Promise.resolve(_pending[0]);
                    } else if (_pending.length > 1) {
                        _result = Promise.all(_pending);
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
                if ((many || _pending.length === 0) && $isPromise(promise)) {
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

var Resolution = Base.extend({
    constructor: function constructor(key, many) {
        if ($isNothing(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        var _resolutions = [],
            _promised = false,
            _result = void 0,
            _instant = $instant.test(key);
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
                        var resolutions = $flatten(_resolutions, true);
                        if (resolutions.length > 0) {
                            _result = resolutions[0];
                        }
                    } else {
                        _result = !_promised ? $flatten(_resolutions, true) : Promise.all(_resolutions).then(function (res) {
                            return $flatten(res, true);
                        });
                    }
                }
                return _result;
            },
            set callbackResult(value) {
                _result = value;
            },
            resolve: function resolve(resolution, composer) {
                var _this = this;

                if (!many && _resolutions.length > 0) {
                    return false;
                }
                if ($isPromise(resolution)) {
                    if (_instant) {
                        return false;
                    }
                    _promised = true;
                    resolution = resolution.then(function (r) {
                        if (_this.isSatisfied(r)) {
                            return r;
                        }
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
            isSatisfied: function isSatisfied(resolution, composer) {
                return true;
            }
        });
    }
});

var Composition = Base.extend({
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
}, {
    isComposed: function isComposed(callback, type) {
        return callback instanceof this && callback.callback instanceof type;
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

var definitions = {};

var $handle = $define(Variance.Contravariant);

var $provide$1 = $define(Variance.Covariant);

var $lookup = $define(Variance.Invariant);

function $unhandled(result) {
    return result === $unhandled;
}

function $define(variance) {
    variance = variance || Variance.Contravariant;
    if (!(variance instanceof Variance)) {
        throw new TypeError("$define expects a Variance parameter");
    }

    var key = Symbol();
    var handled = void 0,
        comparer = void 0;

    switch (variance) {
        case Variance.Covariant:
            handled = requiresResult;
            comparer = compareCovariant;
            break;
        case Variance.Contravariant:
            handled = impliesSuccess;
            comparer = compareContravariant;
            break;
        case Variance.Invariant:
            handled = requiresResult;
            comparer = compareInvariant;
            break;
    }

    function definition(owner, constraint, handler, removed) {
        if (Array.isArray(constraint)) {
            if (constraint.length == 1) {
                constraint = constraint[0];
            } else {
                return constraint.reduce(function (result, c) {
                    var undefine = _definition(owner, c, handler, removed);
                    return function (notifyRemoved) {
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
            handler = constraint;
            constraint = $classOf(Modifier.unwrap(constraint));
        }
        if ($isNothing(handler)) {
            throw new TypeError("Incomplete definition: missing handler for constraint " + constraint);
        } else if (removed && !$isFunction(removed)) {
            throw new TypeError("The removed argument is not a function.");
        }
        if (!$isFunction(handler)) {
            var source = $use.test(handler) ? Modifier.unwrap(handler) : handler;
            handler = $lift(source);
        }
        var binding = new Binding(constraint, handler, removed),
            index = createIndex(binding.constraint),
            list = Metadata.getOrCreateOwn(key, owner, function () {
            return new IndexedList(comparer);
        });
        list.insert(binding, index);
        return function (notifyRemoved) {
            list.remove(binding);
            if (list.isEmpty()) {
                Metadata.remove(key, owner);
            }
            if (binding.removed && notifyRemoved !== false) {
                binding.removed(owner);
            }
        };
    }
    definition.removeAll = function (owner) {
        var list = Metadata.getOwn(key, owner);
        if (!list) {
            return;
        }
        var head = list.head;
        while (head) {
            if (head.removed) {
                head.removed(owner);
            }
            head = head.next;
        }
        Metadata.remove(key, owner);
    };
    definition.dispatch = function (handler, callback, constraint, composer, all, results) {
        var v = variance;
        var delegate = handler.delegate;
        constraint = constraint || callback;

        if (constraint) {
            if ($eq.test(constraint)) {
                v = Variance.Invariant;
            }
            constraint = Modifier.unwrap(constraint);
            if ($isObject(constraint)) {
                constraint = $classOf(constraint);
            }
        }

        var dispatched = dispatch(delegate);
        if (!dispatched || all) {
            dispatched = dispatch(handler) || dispatched;
        }

        function dispatch(target) {
            var dispatched = false;
            if (target) {
                Metadata.collect(key, target, function (list) {
                    dispatched = _dispatch(target, callback, constraint, v, list, composer, all, results) || dispatched;
                    return dispatched && !all;
                });
            }
            return dispatched;
        }

        if (!dispatched) {
            return $unhandled;
        }
    };
    function _dispatch(target, callback, constraint, v, list, composer, all, results) {
        var dispatched = false;
        var invariant = v === Variance.Invariant,
            index = createIndex(constraint);
        if (!invariant || index) {
            var binding = list.getFirst(index) || list.head;
            while (binding) {
                if (binding.match(constraint, v)) {
                    var result = binding.handler.call(target, callback, composer);
                    if (handled(result)) {
                        if (!results || results.call(callback, result, composer) !== false) {
                            if (!all) {
                                return true;
                            }
                            dispatched = true;
                        }
                    }
                } else if (invariant) {
                    break;
                }
                binding = binding.next;
            }
        }
        return dispatched;
    }
    definition.key = key;
    definition.variance = variance;
    Object.freeze(definition);
    return definitions[key] = definition;
}

function Binding(constraint, handler, removed) {
    var invariant = $eq.test(constraint);
    constraint = Modifier.unwrap(constraint);
    this.constraint = constraint;
    this.handler = handler;
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
Binding.prototype.equals = function (other) {
    return this.constraint === other.constraint && (this.handler === other.handler || this.handler.key === other.handler.key);
};

function createIndex(constraint) {
    if (!constraint) {
        return;
    }
    if ($isString(constraint)) {
        return constraint;
    }
    if ($isFunction(constraint)) {
        return assignID(constraint);
    }
}

function matchInvariant(match) {
    return this.constraint === match;
}

function matchEverything(match, variance) {
    return variance !== Variance.Invariant;
}

function matchProtocol(match, variance) {
    var constraint = this.constraint;
    if (constraint === match) {
        return true;
    } else if (variance === Variance.Covariant) {
        return $isProtocol(match) && match.isAdoptedBy(constraint);
    } else if (variance === Variance.Contravariant) {
        return constraint.isAdoptedBy(match);
    }
    return false;
}

function matchClass(match, variance) {
    var constraint = this.constraint;
    if (constraint === match) {
        return true;
    }
    if (variance === Variance.Contravariant) {
        return match.prototype instanceof constraint;
    }
    if (variance === Variance.Covariant) {
        return match.prototype && (constraint.prototype instanceof match || $isProtocol(match) && match.isAdoptedBy(constraint));
    }
    return false;
}

function matchString(match, variance) {
    if (!$isString(match)) {
        return false;
    }
    return variance === Variance.Invariant ? this.constraint == match : this.constraint.toLowerCase() == match.toLowerCase();
}

function matchRegExp(match, variance) {
    return variance !== Variance.Invariant && this.constraint.test(match);
}

function compareCovariant(binding, insert) {
    if (insert.match(binding.constraint, Variance.Invariant)) {
        return 0;
    } else if (insert.match(binding.constraint, Variance.Covariant)) {
        return -1;
    }
    return 1;
}

function compareContravariant(binding, insert) {
    if (insert.match(binding.constraint, Variance.Invariant)) {
        return 0;
    } else if (insert.match(binding.constraint, Variance.Contravariant)) {
        return -1;
    }
    return 1;
}

function compareInvariant(binding, insert) {
    return insert.match(binding.constraint, Variance.Invariant) ? 0 : -1;
}

function requiresResult(result) {
    return result != null && result !== $unhandled;
}

function impliesSuccess(result) {
    return result !== $unhandled;
}

function addDefinition(name, def, allowGets, filter) {
    if (!def) {
        throw new Error("Definition for @" + name + " is missing");
    }
    if (!def.key) {
        throw new Error("Invalid definition @" + name + ": key is missing");
    }
    return function (target, key, descriptor, constraints) {
        if (!isDescriptor(descriptor)) {
            throw new SyntaxError("@" + name + " cannot be applied to classes");
        }
        if (key === "constructor") {
            throw new SyntaxError("@" + name + " cannot be applied to constructors");
        }
        var get = descriptor.get,
            value = descriptor.value;

        if (!$isFunction(value)) {
            if (allowGets) {
                if (!$isFunction(get)) {
                    throw new SyntaxError("@" + name + " can only be applied to methods and getters");
                }
            } else {
                throw new SyntaxError("@" + name + " can only be applied to methods");
            }
        }
        if (constraints.length === 0) {
            constraints = null;
        }
        function lateBinding() {
            var result = this[key];
            if ($isFunction(result)) {
                return result.apply(this, arguments);
            }
            return allowGets ? result : $unhandled;
        }
        var handler = $isFunction(filter) ? function () {
            return filter.apply(this, [key].concat(Array.prototype.slice.call(arguments))) === false ? $unhandled : lateBinding.apply(this, arguments);
        } : lateBinding;
        handler.key = key;
        def(target, constraints, handler);
    };
}

function handle() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
    }

    return decorate$1(addDefinition("handle", $handle), args);
}

function provide() {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
    }

    return decorate$1(addDefinition("provide", $provide$1, true), args);
}

function lookup() {
    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
    }

    return decorate$1(addDefinition("lookup", $lookup, true), args);
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _dec;
var _dec2;
var _dec3;
var _dec4;
var _obj;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
        Object['define' + 'Property'](target, property, desc);
        desc = null;
    }

    return desc;
}

var Handler = Base.extend((_dec = handle(Lookup), _dec2 = handle(Deferred), _dec3 = handle(Resolution), _dec4 = handle(Composition), (_obj = {
    constructor: function constructor(delegate) {
        Object.defineProperty(this, "delegate", {
            value: delegate,
            writable: false
        });
    },
    handle: function handle(callback, greedy, composer) {
        if ($isNothing(callback)) {
            return false;
        }
        if ($isNothing(composer)) {
            composer = compositionScope(this);
        }
        return !!this.handleCallback(callback, !!greedy, composer);
    },
    handleCallback: function handleCallback(callback, greedy, composer) {
        return $handle.dispatch(this, callback, null, composer, greedy) !== $unhandled;
    },
    __lookup: function __lookup(lookup$$1, composer) {
        return $lookup.dispatch(this, lookup$$1, lookup$$1.key, composer, lookup$$1.isMany, lookup$$1.addResult);
    },
    __defered: function __defered(deferred, composer) {
        return $handle.dispatch(this, deferred.callback, null, composer, deferred.isMany, deferred.track);
    },
    __resolution: function __resolution(resolution, composer) {
        var key = resolution.key,
            many = resolution.isMany;
        var resolved = $provide$1.dispatch(this, resolution, key, composer, many, resolution.resolve);
        if (resolved === $unhandled) {
            var implied = new Binding(key),
                delegate = this.delegate;
            if (delegate && implied.match($classOf(delegate), Variance.Contravariant)) {
                resolved = resolution.resolve(delegate, composer);
                if (resolved === false) {
                    resolved = $unhandled;
                }
            }
            if ((resolved === $unhandled || many) && implied.match($classOf(this), Variance.Contravariant)) {
                resolved = resolution.resolve(this, composer);
                if (resolved === false) {
                    resolved = $unhandled;
                }
            }
        }
        if (resolved === $unhandled) {
            return $unhandled;
        }
    },
    __composition: function __composition(composable, composer) {
        var callback = composable.callback;
        if ($isNothing(callback)) {
            return $unhandled;
        }
        return $handle.dispatch(this, callback, null, composer);
    }
}, (_applyDecoratedDescriptor(_obj, "__lookup", [_dec], Object.getOwnPropertyDescriptor(_obj, "__lookup"), _obj), _applyDecoratedDescriptor(_obj, "__defered", [_dec2], Object.getOwnPropertyDescriptor(_obj, "__defered"), _obj), _applyDecoratedDescriptor(_obj, "__resolution", [_dec3], Object.getOwnPropertyDescriptor(_obj, "__resolution"), _obj), _applyDecoratedDescriptor(_obj, "__composition", [_dec4], Object.getOwnPropertyDescriptor(_obj, "__composition"), _obj)), _obj)), {
    coerce: function coerce(object) {
        return new this(object);
    }
});

Base.implement({
    toHandler: function toHandler() {
        return Handler(this);
    }
});

var compositionScope = $decorator({
    handleCallback: function handleCallback(callback, greedy, composer) {
        if (callback.constructor !== Composition) {
            callback = new Composition(callback);
        }
        return this.base(callback, greedy, composer);
    }
});

var CascadeHandler = Handler.extend({
    constructor: function constructor(handler, cascadeToHandler) {
        if ($isNothing(handler)) {
            throw new TypeError("No handler specified.");
        } else if ($isNothing(cascadeToHandler)) {
            throw new TypeError("No cascadeToHandler specified.");
        }
        Object.defineProperties(this, {
            handler: {
                value: handler.toHandler(),
                writable: false
            },

            cascadeToHandler: {
                value: cascadeToHandler.toHandler(),
                writable: false
            }
        });
    },
    handleCallback: function handleCallback(callback, greedy, composer) {
        var handled = this.base(callback, greedy, composer);
        return !!(greedy ? handled | (this.handler.handleCallback(callback, true, composer) | this.cascadeToHandler.handleCallback(callback, true, composer)) : handled || this.handler.handleCallback(callback, false, composer) || this.cascadeToHandler.handleCallback(callback, false, composer));
    }
});

var CompositeHandler = Handler.extend({
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

                handlers = $flatten(handlers, true).map(function (h) {
                    return h.toHandler();
                });
                _handlers.push.apply(_handlers, _toConsumableArray(handlers));
                return this;
            },
            insertHandlers: function insertHandlers(atIndex) {
                for (var _len3 = arguments.length, handlers = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                    handlers[_key3 - 1] = arguments[_key3];
                }

                handlers = $flatten(handlers, true).map(function (h) {
                    return h.toHandler();
                });
                _handlers.splice.apply(_handlers, [atIndex, 0].concat(_toConsumableArray(handlers)));
                return this;
            },
            removeHandlers: function removeHandlers() {
                for (var _len4 = arguments.length, handlers = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                    handlers[_key4] = arguments[_key4];
                }

                $flatten(handlers).forEach(function (handler) {
                    if (!handler) {
                        return;
                    }
                    var count = _handlers.length;
                    for (var idx = 0; idx < count; ++idx) {
                        var testHandler = _handlers[idx];
                        if (testHandler == handler || testHandler.delegate == handler) {
                            _handlers.splice(idx, 1);
                            return;
                        }
                    }
                });
                return this;
            },
            handleCallback: function handleCallback(callback, greedy, composer) {
                var handled = this.base(callback, greedy, composer);
                if (handled && !greedy) {
                    return true;
                }
                var count = _handlers.length;
                for (var idx = 0; idx < count; ++idx) {
                    var handler = _handlers[idx];
                    if (handler.handleCallback(callback, greedy, composer)) {
                        if (!greedy) {
                            return true;
                        }
                        handled = true;
                    }
                }
                return handled;
            }
        });
        this.addHandlers(handlers);
    }
});

Handler.accepting = function (handler, constraint) {
    var accepting = new Handler();
    $handle(accepting, constraint, handler);
    return accepting;
};

Handler.providing = function (provider, constraint) {
    var providing = new Handler();
    $provide$1(providing, constraint, provider);
    return providing;
};

Handler.registerPolicy = function (policyType, key) {
    if (Handler.prototype.hasOwnProperty(key)) {
        return false;
    }
    Handler.implement(_defineProperty({}, key, function (policy) {
        var _dec5, _desc2, _value2, _obj2;

        return policy ? this.decorate((_dec5 = handle(policyType), (_obj2 = {
            mergePolicy: function mergePolicy(receiver) {
                policy.mergeInto(receiver);
            }
        }, (_applyDecoratedDescriptor(_obj2, "mergePolicy", [_dec5], Object.getOwnPropertyDescriptor(_obj2, "mergePolicy"), _obj2)), _obj2))) : this;
    }));
    return true;
};

Handler.implement({
    defer: function defer(callback) {
        var deferred = new Deferred(callback);
        this.handle(deferred, false);
        return deferred.callbackResult;
    },
    deferAll: function deferAll(callback) {
        var deferred = new Deferred(callback, true);
        this.handle(deferred, true);
        return deferred.callbackResult;
    },
    resolve: function resolve(key) {
        var resolution = key instanceof Resolution ? key : new Resolution(key);
        if (this.handle(resolution, false)) {
            return resolution.callbackResult;
        }
    },
    resolveAll: function resolveAll(key) {
        var resolution = key instanceof Resolution ? key : new Resolution(key, true);
        return this.handle(resolution, true) ? resolution.callbackResult : [];
    },
    lookup: function lookup$$1(key) {
        var lookup$$1 = key instanceof Lookup ? key : new Lookup(key);
        if (this.handle(lookup$$1, false)) {
            return lookup$$1.callbackResult;
        }
    },
    lookupAll: function lookupAll(key) {
        var lookup$$1 = key instanceof Lookup ? key : new Lookup(key, true);
        return this.handle(lookup$$1, true) ? lookup$$1.callbackResult : [];
    },
    decorate: function decorate(decorations) {
        return $decorate(this, decorations);
    },
    filter: function filter(_filter, reentrant) {
        if (!$isFunction(_filter)) {
            throw new TypeError("Invalid filter: " + _filter + " is not a function.");
        }
        return this.decorate({
            handleCallback: function handleCallback(callback, greedy, composer) {
                var _this = this;

                if (!reentrant && callback instanceof Composition) {
                    return this.base(callback, greedy, composer);
                }
                var base = this.base;
                return _filter(callback, composer, function () {
                    return base.call(_this, callback, greedy, composer);
                });
            }
        });
    },
    aspect: function aspect(before, after, reentrant) {
        return this.filter(function (callback, composer, proceed) {
            if ($isFunction(before)) {
                var test = before(callback, composer);
                if ($isPromise(test)) {
                    var _ret = function () {
                        var hasResult = "callbackResult" in callback,
                            accept = test.then(function (accepted) {
                            if (accepted !== false) {
                                aspectProceed(callback, composer, proceed, after, accepted);
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

                    if ((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object") return _ret.v;
                } else if (test === false) {
                    throw new RejectedError(callback);
                }
            }
            return aspectProceed(callback, composer, proceed, after);
        }, reentrant);
    },
    $provide: function $provide() {
        var _this2 = this;

        for (var _len5 = arguments.length, values = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
            values[_key5] = arguments[_key5];
        }

        values = $flatten(values, true);
        if (values.length > 0) {
            var _ret2 = function () {
                var provider = _this2.decorate();
                values.forEach(function (value) {
                    return $provide$1(provider, value);
                });
                return {
                    v: provider
                };
            }();

            if ((typeof _ret2 === "undefined" ? "undefined" : _typeof(_ret2)) === "object") return _ret2.v;
        }
        return this;
    },
    when: function when(constraint) {
        var when = new Binding(constraint),
            condition = function condition(callback) {
            if (callback instanceof Deferred) {
                return when.match($classOf(callback.callback), Variance.Contravariant);
            } else if (callback instanceof Resolution) {
                return when.match(callback.key, Variance.Covariant);
            } else {
                return when.match($classOf(callback), Variance.Contravariant);
            }
        };
        return this.decorate({
            handleCallback: function handleCallback(callback, greedy, composer) {
                return condition(callback) && this.base(callback, greedy, composer);
            }
        });
    },
    next: function next() {
        for (var _len6 = arguments.length, handlers = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
            handlers[_key6] = arguments[_key6];
        }

        switch (handlers.length) {
            case 0:
                return this;
            case 1:
                return new CascadeHandler(this, handlers[0]);
            default:
                return new (Function.prototype.bind.apply(CompositeHandler, [null].concat([this], _toConsumableArray(handlers))))();
        }
    },
    $guard: function $guard(target, property) {
        var _this3 = this;

        if (target) {
            var _ret3 = function () {
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

            if ((typeof _ret3 === "undefined" ? "undefined" : _typeof(_ret3)) === "object") return _ret3.v;
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
                    callback.callbackResult = $isPromise(result) ? result : Promise.resolve(result);
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
                    if ($isPromise(result)) {
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
                                } else if ($isFunction(error)) {
                                    error = Reflect.construct(error, [callback]);
                                }
                                if ($isFunction(result.reject)) {
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

function aspectProceed(callback, composer, proceed, after, state) {
    var promise = void 0;
    try {
        var handled = proceed();
        if (handled) {
            var result = callback.callbackResult;
            if ($isPromise(result)) {
                promise = result;

                if ($isFunction(after)) {
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
        if (!promise && $isFunction(after)) {
            after(callback, composer, state);
        }
    }
}

var Batching = StrictProtocol.extend({
    complete: function complete(composer) {}
});

var BatchingComplete = Batching.extend();

var Batcher = CompositeHandler.extend(BatchingComplete, {
    constructor: function constructor() {
        for (var _len = arguments.length, protocols = Array(_len), _key = 0; _key < _len; _key++) {
            protocols[_key] = arguments[_key];
        }

        this.base();
        protocols = $flatten(protocols, true);
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
                promise = promise || $isPromise(result);
                res.push(result);
                return res;
            }
        }, []);
        return promise ? Promise.all(results) : results;
    }
});

Handler.implement({
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
                            if ($isPromise(result)) {
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

var _dec$1;
var _obj$1;

function _applyDecoratedDescriptor$1(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
        Object['define' + 'Property'](target, property, desc);
        desc = null;
    }

    return desc;
}

var $composer = void 0;

var InvocationOptions = Flags({
    None: 0,

    Broadcast: 1 << 0,

    BestEffort: 1 << 1,

    Strict: 1 << 2,

    Resolve: 1 << 3,

    Notify: 1 << 0 | 1 << 1
});

var InvocationSemantics = Composition.extend({
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

var HandleMethod = Base.extend({
    constructor: function constructor(methodType, protocol, methodName, args, semantics) {
        if (protocol && !$isProtocol(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        var _returnValue = void 0,
            _exception = void 0;
        this.extend({
            get methodType() {
                return methodType;
            },

            get protocol() {
                return protocol;
            },

            get methodName() {
                return methodName;
            },

            get methodArgs() {
                return args;
            },
            set methodArgs(value) {
                args = value;
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
                if (!target) {
                    return false;
                }
                if (protocol) {
                    var strict = semantics.getOption(InvocationOptions.Strict);
                    if (strict && !protocol.isAdoptedBy(target)) {
                        return false;
                    }
                }
                var method = void 0,
                    result = void 0;
                if (methodType === MethodType.Invoke) {
                    method = target[methodName];
                    if (!$isFunction(method)) {
                        return false;
                    }
                }
                var oldComposer = $composer;
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
            },
            createNotHandledError: function createNotHandledError() {
                var qualifier = "";
                switch (methodType) {
                    case MethodType.Get:
                        qualifier = " (get)";
                        break;
                    case MethodType.Set:
                        qualifier = " (set)";
                        break;
                }
                return new TypeError("Protocol " + protocol.name + ":" + methodName + qualifier + " could not be handled.");
            }
        });
    }
});

var ResolveMethod = Resolution.extend({
    constructor: function constructor(key, many, handleMethod, bestEffort) {
        var _handled;
        this.base(key, many);
        this.extend({
            get callbackResult() {
                var result = this.base();
                if ($isPromise(result)) {
                    return result.then(function (r) {
                        return _handled || bestEffort ? handleMethod.callbackResult : Promise.reject(handleMethod.createNotHandledError());
                    });
                }
                if (_handled || bestEffort) {
                    return handleMethod.callbackResult;
                }
                throw handleMethod.createNotHandledError();
            },
            isSatisfied: function isSatisfied(resolution, composer) {
                var handled = handleMethod.invokeOn(resolution, composer);
                _handled = _handled || handled;
                return handled;
            }
        });
    }
});

var InvocationDelegate = Delegate.extend({
    constructor: function constructor(handler) {
        this.extend({
            get handler() {
                return handler;
            }
        });
    },
    get: function get(protocol, propertyName) {
        return delegate(this, MethodType.Get, protocol, propertyName, null);
    },
    set: function set(protocol, propertyName, propertyValue) {
        return delegate(this, MethodType.Set, protocol, propertyName, propertyValue);
    },
    invoke: function invoke(protocol, methodName, args) {
        return delegate(this, MethodType.Invoke, protocol, methodName, args);
    }
});

function delegate(delegate, methodType, protocol, methodName, args) {
    var handler = delegate.handler,
        options = InvocationOptions.None,
        semantics = new InvocationSemantics();
    handler.handle(semantics, true);

    if (!semantics.isSpecified(InvocationOptions.Strict) && StrictProtocol.isAdoptedBy(protocol)) options |= InvocationOptions.Strict;

    if (!semantics.isSpecified(InvocationOptions.Resolve) && Resolving.isAdoptedBy(protocol)) options |= InvocationOptions.Resolve;

    if (options != InvocationOptions.None) {
        semantics.setOption(options, true);
        handler = handler.$callOptions(options);
    }

    var broadcast = semantics.getOption(InvocationOptions.Broadcast),
        bestEffort = semantics.getOption(InvocationOptions.BestEffort),
        handleMethod = new HandleMethod(methodType, protocol, methodName, args, semantics),
        callback = semantics.getOption(InvocationOptions.Resolve) ? new ResolveMethod(protocol, broadcast, handleMethod, bestEffort) : handleMethod;

    if (!handler.handle(callback, broadcast) && !bestEffort) {
        throw handleMethod.createNotHandledError();
    }

    return callback.callbackResult;
}

Handler.implement((_dec$1 = handle(HandleMethod), (_obj$1 = {
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
                if (Composition.isComposed(callback, InvocationSemantics)) {
                    return false;
                }
                if (callback instanceof InvocationSemantics) {
                    semantics.mergeInto(callback);
                    handled = true;
                } else if (!greedy) {
                    if (semantics.isSpecified(InvocationOptions.Broadcast)) {
                        greedy = semantics.getOption(InvocationOptions.Broadcast);
                    } else {
                        var inv = new InvocationSemantics();
                        if (this.handle(inv, true) && inv.isSpecified(InvocationOptions.Broadcast)) {
                            greedy = inv.getOption(InvocationOptions.Broadcast);
                        }
                    }
                }
                if (greedy || !handled) {
                    handled = this.base(callback, greedy, composer) || handled;
                }
                return !!handled;
            }
        });
    },
    __handleMethod: function __handleMethod(method, composer) {
        if (!(method.invokeOn(this.delegate, composer) || method.invokeOn(this, composer))) {
            return $unhandled;
        }
    }
}, (_applyDecoratedDescriptor$1(_obj$1, "__handleMethod", [_dec$1], Object.getOwnPropertyDescriptor(_obj$1, "__handleMethod"), _obj$1)), _obj$1)));

Handler.implementing = function (methodName, method) {
    if (!$isString(methodName) || methodName.length === 0 || !methodName.trim()) {
        throw new TypeError("No methodName specified.");
    } else if (!$isFunction(method)) {
        throw new TypeError("Invalid method: " + method + " is not a function.");
    }
    return new Handler().extend({
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

export { Batching, Batcher, Lookup, Deferred, Resolution, Composition, RejectedError, TimeoutError, addDefinition, handle, provide, lookup, $handle, $provide$1 as $provide, $lookup, $unhandled, $define, Binding, Handler, CascadeHandler, CompositeHandler, $composer, InvocationOptions, InvocationSemantics, HandleMethod, ResolveMethod, InvocationDelegate };
