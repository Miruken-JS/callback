define(["exports", "miruken-core"], function (exports, _mirukenCore) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.InvocationDelegate = exports.InvocationSemantics = exports.InvocationOptions = exports.Batcher = exports.Batching = exports.CompositeHandler = exports.CascadeHandler = exports.Handler = exports.Composition = exports.Resolution = exports.Deferred = exports.Lookup = exports.ResolveMethod = exports.HandleMethod = exports.$composer = exports.$lookup = exports.$provide = exports.$handle = undefined;
    exports.$unhandled = $unhandled;
    exports.$define = $define;
    exports.Binding = Binding;
    exports.RejectedError = RejectedError;
    exports.TimeoutError = TimeoutError;
    exports.addDefinition = addDefinition;
    exports.handle = handle;
    exports.provide = provide;
    exports.lookup = lookup;

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };

    function _defineProperty(obj, key, value) {
        if (key in obj) {
            Object.defineProperty(obj, key, {
                value: value,
                enumerable: true,
                configurable: true,
                writable: true
            });
        } else {
            obj[key] = value;
        }

        return obj;
    }

    function _toConsumableArray(arr) {
        if (Array.isArray(arr)) {
            for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
                arr2[i] = arr[i];
            }

            return arr2;
        } else {
            return Array.from(arr);
        }
    }

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

    var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _desc, _value, _obj;

    var definitions = {};

    var $handle = exports.$handle = $define(_mirukenCore.Variance.Contravariant);

    var _$provide = $define(_mirukenCore.Variance.Covariant);

    exports.$provide = _$provide;
    var $lookup = exports.$lookup = $define(_mirukenCore.Variance.Invariant);

    function $unhandled(result) {
        return result === $unhandled;
    }

    function $define(variance) {
        variance = variance || _mirukenCore.Variance.Contravariant;
        if (!(variance instanceof _mirukenCore.Variance)) {
            throw new TypeError("$define expects a Variance parameter");
        }

        var key = Symbol();
        var handled = void 0,
            comparer = void 0;

        switch (variance) {
            case _mirukenCore.Variance.Covariant:
                handled = requiresResult;
                comparer = compareCovariant;
                break;
            case _mirukenCore.Variance.Contravariant:
                handled = impliesSuccess;
                comparer = compareContravariant;
                break;
            case _mirukenCore.Variance.Invariant:
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
                    }, _mirukenCore.Undefined);
                }
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
                throw new TypeError("Incomplete definition: missing handler for constraint " + constraint);
            } else if (removed && !(0, _mirukenCore.$isFunction)(removed)) {
                throw new TypeError("The removed argument is not a function.");
            }
            if (!(0, _mirukenCore.$isFunction)(handler)) {
                var source = _mirukenCore.$use.test(handler) ? _mirukenCore.Modifier.unwrap(handler) : handler;
                handler = (0, _mirukenCore.$lift)(source);
            }
            var binding = new Binding(constraint, handler, removed),
                index = createIndex(binding.constraint),
                list = _mirukenCore.Metadata.getOrCreateOwn(key, owner, function () {
                return new _mirukenCore.IndexedList(comparer);
            });
            list.insert(binding, index);
            return function (notifyRemoved) {
                list.remove(binding);
                if (list.isEmpty()) {
                    _mirukenCore.Metadata.remove(key, owner);
                }
                if (binding.removed && notifyRemoved !== false) {
                    binding.removed(owner);
                }
            };
        };
        definition.removeAll = function (owner) {
            var list = _mirukenCore.Metadata.getOwn(key, owner);
            if (!list) {
                return;
            };
            var head = list.head;
            while (head) {
                if (head.removed) {
                    head.removed(owner);
                }
                head = head.next;
            }
            _mirukenCore.Metadata.remove(key, owner);
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
                if ((0, _mirukenCore.$isObject)(constraint)) {
                    constraint = (0, _mirukenCore.$classOf)(constraint);
                }
            }

            var dispatched = dispatch(delegate);
            if (!dispatched || all) {
                dispatched = dispatch(handler) || dispatched;
            }

            function dispatch(target) {
                var dispatched = false;
                if (target) {
                    _mirukenCore.Metadata.collect(key, target, function (list) {
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
            var invariant = v === _mirukenCore.Variance.Invariant,
                index = createIndex(constraint);
            if (!invariant || index) {
                var binding = list.getFirst(index) || list.head;
                while (binding) {
                    if (binding.match(constraint, v)) {
                        var result = binding.handler.call(target, callback, composer);
                        if (handled(result)) {
                            if (results) {
                                results.call(callback, result);
                            }
                            if (!all) {
                                return true;
                            }
                            dispatched = true;
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
        var invariant = _mirukenCore.$eq.test(constraint);
        constraint = _mirukenCore.Modifier.unwrap(constraint);
        this.constraint = constraint;
        this.handler = handler;
        if ((0, _mirukenCore.$isNothing)(constraint)) {
            this.match = invariant ? _mirukenCore.False : matchEverything;
        } else if ((0, _mirukenCore.$isProtocol)(constraint)) {
            this.match = invariant ? matchInvariant : matchProtocol;
        } else if ((0, _mirukenCore.$isClass)(constraint)) {
            this.match = invariant ? matchInvariant : matchClass;
        } else if ((0, _mirukenCore.$isString)(constraint)) {
            this.match = matchString;
        } else if (constraint instanceof RegExp) {
            this.match = invariant ? _mirukenCore.False : matchRegExp;
        } else if ((0, _mirukenCore.$isFunction)(constraint)) {
            this.match = constraint;
        } else {
            this.match = _mirukenCore.False;
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
        if ((0, _mirukenCore.$isString)(constraint)) {
            return constraint;
        }
        if ((0, _mirukenCore.$isFunction)(constraint)) {
            return (0, _mirukenCore.assignID)(constraint);
        }
    }

    function matchInvariant(match) {
        return this.constraint === match;
    }

    function matchEverything(match, variance) {
        return variance !== _mirukenCore.Variance.Invariant;
    }

    function matchProtocol(match, variance) {
        var constraint = this.constraint;
        if (constraint === match) {
            return true;
        } else if (variance === _mirukenCore.Variance.Covariant) {
            return (0, _mirukenCore.$isProtocol)(match) && match.isAdoptedBy(constraint);
        } else if (variance === _mirukenCore.Variance.Contravariant) {
            return constraint.isAdoptedBy(match);
        }
        return false;
    }

    function matchClass(match, variance) {
        var constraint = this.constraint;
        if (constraint === match) {
            return true;
        }
        if (variance === _mirukenCore.Variance.Contravariant) {
            return match.prototype instanceof constraint;
        }
        if (variance === _mirukenCore.Variance.Covariant) {
            return match.prototype && (constraint.prototype instanceof match || (0, _mirukenCore.$isProtocol)(match) && match.isAdoptedBy(constraint));
        }
        return false;
    }

    function matchString(match, variance) {
        if (!(0, _mirukenCore.$isString)(match)) {
            return false;
        }
        return variance === _mirukenCore.Variance.Invariant ? this.constraint == match : this.constraint.toLowerCase() == match.toLowerCase();
    }

    function matchRegExp(match, variance) {
        return variance !== _mirukenCore.Variance.Invariant && this.constraint.test(match);
    }

    function compareCovariant(binding, insert) {
        if (insert.match(binding.constraint, _mirukenCore.Variance.Invariant)) {
            return 0;
        } else if (insert.match(binding.constraint, _mirukenCore.Variance.Covariant)) {
            return -1;
        }
        return 1;
    }

    function compareContravariant(binding, insert) {
        if (insert.match(binding.constraint, _mirukenCore.Variance.Invariant)) {
            return 0;
        } else if (insert.match(binding.constraint, _mirukenCore.Variance.Contravariant)) {
            return -1;
        }
        return 1;
    }

    function compareInvariant(binding, insert) {
        return insert.match(binding.constraint, _mirukenCore.Variance.Invariant) ? 0 : -1;
    }

    function requiresResult(result) {
        return result != null && result !== $unhandled;
    }

    function impliesSuccess(result) {
        return result !== $unhandled;
    }

    var $composer = exports.$composer = void 0;

    var HandleMethod = exports.HandleMethod = _mirukenCore.Base.extend({
        constructor: function constructor(methodType, protocol, methodName, args, strict) {
            if (protocol && !(0, _mirukenCore.$isProtocol)(protocol)) {
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
                    if (!target || strict && protocol && !protocol.isAdoptedBy(target)) {
                        return false;
                    }
                    var method = void 0,
                        result = void 0;
                    if (methodType === _mirukenCore.MethodType.Invoke) {
                        method = target[methodName];
                        if (!(0, _mirukenCore.$isFunction)(method)) {
                            return false;
                        }
                    }
                    var oldComposer = $composer;
                    try {
                        exports.$composer = $composer = composer;
                        switch (methodType) {
                            case _mirukenCore.MethodType.Get:
                                result = target[methodName];
                                break;
                            case _mirukenCore.MethodType.Set:
                                result = target[methodName] = args;
                                break;
                            case _mirukenCore.MethodType.Invoke:
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
                        exports.$composer = $composer = oldComposer;
                    }
                }
            });
        }
    });

    var ResolveMethod = exports.ResolveMethod = HandleMethod.extend({
        constructor: function constructor(methodType, protocol, methodName, args, strict, all, required) {
            this.base(methodType, protocol, methodName, args, strict);
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
                                    reject(new TypeError("Object " + composer + " has no method '" + methodName + "'"));
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

    function addDefinition(name, def, allowGets, filter) {
        if (!def) {
            throw new Error("Definition for @" + name + " is missing");
        }
        if (!def.key) {
            throw new Error("Invalid definition @" + name + ": key is missing");
        }
        return function (target, key, descriptor, constraints) {
            if (!(0, _mirukenCore.isDescriptor)(descriptor)) {
                throw new SyntaxError("@" + name + " cannot be applied to classes");
            }
            if (key === "constructor") {
                throw new SyntaxError("@" + name + " cannot be applied to constructors");
            }
            var get = descriptor.get;
            var value = descriptor.value;

            if (!(0, _mirukenCore.$isFunction)(value)) {
                if (allowGets) {
                    if (!(0, _mirukenCore.$isFunction)(get)) {
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
                if ((0, _mirukenCore.$isFunction)(result)) {
                    return result.apply(this, arguments);
                }
                return allowGets ? result : $unhandled;
            }
            var handler = (0, _mirukenCore.$isFunction)(filter) ? function () {
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

        return (0, _mirukenCore.decorate)(addDefinition("handle", $handle), args);
    }

    function provide() {
        for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
        }

        return (0, _mirukenCore.decorate)(addDefinition("provide", _$provide, true), args);
    }

    function lookup() {
        for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
            args[_key3] = arguments[_key3];
        }

        return (0, _mirukenCore.decorate)(addDefinition("lookup", $lookup, true), args);
    }

    var Handler = exports.Handler = _mirukenCore.Base.extend((_dec = handle(Lookup), _dec2 = handle(Deferred), _dec3 = handle(Resolution), _dec4 = handle(HandleMethod), _dec5 = handle(ResolveMethod), _dec6 = handle(Composition), (_obj = {
        constructor: function constructor(delegate) {
            Object.defineProperty(this, "delegate", {
                value: delegate,
                writable: false
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
            return $handle.dispatch(this, callback, null, composer, greedy) !== $unhandled;
        },
        __lookup: function __lookup(lookup, composer) {
            return $lookup.dispatch(this, lookup, lookup.key, composer, lookup.isMany, lookup.addResult);
        },
        __defered: function __defered(deferred, composer) {
            return $handle.dispatch(this, deferred.callback, null, composer, deferred.isMany, deferred.track);
        },
        __resolution: function __resolution(resolution, composer) {
            var key = resolution.key,
                many = resolution.isMany;
            var resolved = _$provide.dispatch(this, resolution, key, composer, many, resolution.resolve);
            if (resolved === $unhandled) {
                var implied = new Binding(key),
                    _delegate = this.delegate;
                if (_delegate && implied.match((0, _mirukenCore.$classOf)(_delegate), _mirukenCore.Variance.Contravariant)) {
                    resolution.resolve((0, _mirukenCore.$decorated)(_delegate, true));
                    resolved = true;
                }
                if ((resolved === $unhandled || many) && implied.match((0, _mirukenCore.$classOf)(this), _mirukenCore.Variance.Contravariant)) {
                    resolution.resolve((0, _mirukenCore.$decorated)(this, true));
                    resolved = true;
                }
            }
            if (resolved === $unhandled) {
                return resolved;
            };
        },
        __handleMethod: function __handleMethod(method, composer) {
            if (!(method.invokeOn(this.delegate, composer) || method.invokeOn(this, composer))) {
                return $unhandled;
            }
        },
        __resolveMethod: function __resolveMethod(method, composer) {
            if (!method.invokeResolve(composer)) {
                return $unhandled;
            }
        },
        __composition: function __composition(composable, composer) {
            var callback = composable.callback;
            if ((0, _mirukenCore.$isNothing)(callback)) {
                return $unhandled;
            }
            return $handle.dispatch(this, callback, null, composer);
        }
    }, (_applyDecoratedDescriptor(_obj, "__lookup", [_dec], Object.getOwnPropertyDescriptor(_obj, "__lookup"), _obj), _applyDecoratedDescriptor(_obj, "__defered", [_dec2], Object.getOwnPropertyDescriptor(_obj, "__defered"), _obj), _applyDecoratedDescriptor(_obj, "__resolution", [_dec3], Object.getOwnPropertyDescriptor(_obj, "__resolution"), _obj), _applyDecoratedDescriptor(_obj, "__handleMethod", [_dec4], Object.getOwnPropertyDescriptor(_obj, "__handleMethod"), _obj), _applyDecoratedDescriptor(_obj, "__resolveMethod", [_dec5], Object.getOwnPropertyDescriptor(_obj, "__resolveMethod"), _obj), _applyDecoratedDescriptor(_obj, "__composition", [_dec6], Object.getOwnPropertyDescriptor(_obj, "__composition"), _obj)), _obj)), {
        coerce: function coerce(object) {
            return new this(object);
        }
    });

    _mirukenCore.Base.implement({
        toHandler: function toHandler() {
            return Handler(this);
        }
    });

    var compositionScope = (0, _mirukenCore.$decorator)({
        handleCallback: function handleCallback(callback, greedy, composer) {
            if (callback.constructor !== Composition) {
                callback = new Composition(callback);
            }
            return this.base(callback, greedy, composer);
        }
    });

    var CascadeHandler = exports.CascadeHandler = Handler.extend({
        constructor: function constructor(handler, cascadeToHandler) {
            if ((0, _mirukenCore.$isNothing)(handler)) {
                throw new TypeError("No handler specified.");
            } else if ((0, _mirukenCore.$isNothing)(cascadeToHandler)) {
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

    var CompositeHandler = exports.CompositeHandler = Handler.extend({
        constructor: function constructor() {
            for (var _len4 = arguments.length, handlers = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                handlers[_key4] = arguments[_key4];
            }

            var _handlers = [];
            this.extend({
                getHandlers: function getHandlers() {
                    return _handlers.slice();
                },
                addHandlers: function addHandlers() {
                    for (var _len5 = arguments.length, handlers = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
                        handlers[_key5] = arguments[_key5];
                    }

                    handlers = (0, _mirukenCore.$flatten)(handlers, true).map(function (h) {
                        return h.toHandler();
                    });
                    _handlers.push.apply(_handlers, _toConsumableArray(handlers));
                    return this;
                },
                insertHandlers: function insertHandlers(atIndex) {
                    for (var _len6 = arguments.length, handlers = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
                        handlers[_key6 - 1] = arguments[_key6];
                    }

                    handlers = (0, _mirukenCore.$flatten)(handlers, true).map(function (h) {
                        return h.toHandler();
                    });
                    _handlers.splice.apply(_handlers, [atIndex, 0].concat(_toConsumableArray(handlers)));
                    return this;
                },
                removeHandlers: function removeHandlers() {
                    for (var _len7 = arguments.length, handlers = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
                        handlers[_key7] = arguments[_key7];
                    }

                    (0, _mirukenCore.$flatten)(handlers).forEach(function (handler) {
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
        _$provide(providing, constraint, provider);
        return providing;
    };

    Handler.implementing = function (methodName, method) {
        if (!(0, _mirukenCore.$isString)(methodName) || methodName.length === 0 || !methodName.trim()) {
            throw new TypeError("No methodName specified.");
        } else if (!(0, _mirukenCore.$isFunction)(method)) {
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

    Handler.registerPolicy = function (policyType, key) {
        if (Handler.prototype.hasOwnProperty(key)) {
            return false;
        }
        Handler.implement(_defineProperty({}, key, function (policy) {
            var _dec7, _desc2, _value2, _obj2;

            return policy ? this.decorate((_dec7 = handle(policyType), (_obj2 = {
                mergePolicy: function mergePolicy(receiver) {
                    policy.mergeInto(receiver);
                }
            }, (_applyDecoratedDescriptor(_obj2, "mergePolicy", [_dec7], Object.getOwnPropertyDescriptor(_obj2, "mergePolicy"), _obj2)), _obj2))) : this;
        }));
        return true;
    };

    Handler.implement({
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
                throw new TypeError("Invalid filter: " + _filter + " is not a function.");
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
            var _this3 = this;

            for (var _len8 = arguments.length, values = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
                values[_key8] = arguments[_key8];
            }

            values = (0, _mirukenCore.$flatten)(values, true);
            if (values.length > 0) {
                var _ret2 = function () {
                    var provider = _this3.decorate();
                    values.forEach(function (value) {
                        return _$provide(provider, value);
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
            for (var _len9 = arguments.length, handlers = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
                handlers[_key9] = arguments[_key9];
            }

            switch (handlers.length) {
                case 0:
                    return this;
                case 1:
                    return new CascadeHandler(this, handlers[0]);
                default:
                    return new (Function.prototype.bind.apply(CompositeHandler, [null].concat([this], handlers)))();
            }
        },
        $guard: function $guard(target, property) {
            var _this4 = this;

            if (target) {
                var _ret3 = function () {
                    var guarded = false;
                    property = property || "guarded";
                    var propExists = property in target;
                    return {
                        v: _this4.aspect(function () {
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

    function aspectProceed(callback, composer, proceed, after, state) {
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

    var Batcher = exports.Batcher = CompositeHandler.extend(BatchingComplete, {
        constructor: function constructor() {
            for (var _len10 = arguments.length, protocols = Array(_len10), _key10 = 0; _key10 < _len10; _key10++) {
                protocols[_key10] = arguments[_key10];
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
            return delegate(this, _mirukenCore.MethodType.Get, protocol, propertyName, null, strict);
        },
        set: function set(protocol, propertyName, propertyValue, strict) {
            return delegate(this, _mirukenCore.MethodType.Set, protocol, propertyName, propertyValue, strict);
        },
        invoke: function invoke(protocol, methodName, args, strict) {
            return delegate(this, _mirukenCore.MethodType.Invoke, protocol, methodName, args, strict);
        }
    });

    function delegate(delegate, methodType, protocol, methodName, args, strict) {
        var broadcast = false,
            bestEffort = false,
            useResolve = _mirukenCore.Resolving.isAdoptedBy(protocol),
            handler = delegate.handler;

        var semantics = new InvocationSemantics();
        if (handler.handle(semantics, true)) {
            strict = !!(strict | semantics.getOption(InvocationOptions.Strict));
            broadcast = semantics.getOption(InvocationOptions.Broadcast);
            bestEffort = semantics.getOption(InvocationOptions.BestEffort);
            useResolve = useResolve || semantics.getOption(InvocationOptions.Resolve);
        }

        var handleMethod = useResolve ? new ResolveMethod(methodType, protocol, methodName, args, strict, broadcast, !bestEffort) : new HandleMethod(methodType, protocol, methodName, args, strict);

        if (!handler.handle(handleMethod, broadcast && !useResolve) && !bestEffort) {
            throw new TypeError("Object " + handler + " has no method '" + methodName + "'");
        }

        return handleMethod.returnValue;
    }

    Handler.implement({
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
});