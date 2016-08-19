'use strict';

System.register(['miruken-core'], function (_export, _context) {
    "use strict";

    var False, True, Undefined, Base, Abstract, extend, typeOf, assignID, Variance, $meta, $isNothing, $isString, $isFunction, $isClass, $isProtocol, $classOf, Modifier, IndexedList, $eq, $use, $copy, $lift, MethodType, $isPromise, $instant, $flatten, decorate, $decorator, $decorate, $decorated, StrictProtocol, Flags, Delegate, Resolving, _typeof, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _desc, _value, _obj, _definitions, $handle, $provide, $lookup, $NOT_HANDLED, $composer, HandleMethod, ResolveMethod, Lookup, Deferred, Resolution, Composition, CallbackHandler, compositionScope, CascadeCallbackHandler, CompositeCallbackHandler, Batching, BatchingComplete, Batcher, InvocationOptions, InvocationSemantics, InvocationDelegate;

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
        var constraint = this.constraint;
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
        var constraint = this.constraint;
        if (constraint === match) {
            return true;
        } else if (variance === Variance.Contravariant) {
            return match.prototype instanceof constraint;
        } else if (variance === Variance.Covariant) {
            return match.prototype && (constraint.prototype instanceof match || $isProtocol(match) && match.adoptedBy(constraint));
        }
        return false;
    }

    function matchString(match) {
        return $isString(match) && this.constraint == match;
    }

    function matchRegExp(match, variance) {
        return variance !== Variance.Invariant && this.constraint.test(match);
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
        return result !== null && result !== undefined && result !== $NOT_HANDLED;
    }

    function impliesSuccess(result) {
        return result ? result !== $NOT_HANDLED : result === undefined;
    }

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

    function delegate(delegate, methodType, protocol, methodName, args, strict) {
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
                useResolve = semantics.getOption(InvocationOptions.Resolve) || protocol.conformsTo(Resolving);
            }
        }
        var handleMethod = useResolve ? new ResolveMethod(methodType, protocol, methodName, args, strict, broadcast, !bestEffort) : new HandleMethod(methodType, protocol, methodName, args, strict);
        if (!handler.handle(handleMethod, broadcast && !useResolve) && !bestEffort) {
            throw new TypeError('Object ' + handler + ' has no method \'' + methodName + '\'');
        }
        return handleMethod.returnValue;
    }

    return {
        setters: [function (_mirukenCore) {
            False = _mirukenCore.False;
            True = _mirukenCore.True;
            Undefined = _mirukenCore.Undefined;
            Base = _mirukenCore.Base;
            Abstract = _mirukenCore.Abstract;
            extend = _mirukenCore.extend;
            typeOf = _mirukenCore.typeOf;
            assignID = _mirukenCore.assignID;
            Variance = _mirukenCore.Variance;
            $meta = _mirukenCore.$meta;
            $isNothing = _mirukenCore.$isNothing;
            $isString = _mirukenCore.$isString;
            $isFunction = _mirukenCore.$isFunction;
            $isClass = _mirukenCore.$isClass;
            $isProtocol = _mirukenCore.$isProtocol;
            $classOf = _mirukenCore.$classOf;
            Modifier = _mirukenCore.Modifier;
            IndexedList = _mirukenCore.IndexedList;
            $eq = _mirukenCore.$eq;
            $use = _mirukenCore.$use;
            $copy = _mirukenCore.$copy;
            $lift = _mirukenCore.$lift;
            MethodType = _mirukenCore.MethodType;
            $isPromise = _mirukenCore.$isPromise;
            $instant = _mirukenCore.$instant;
            $flatten = _mirukenCore.$flatten;
            decorate = _mirukenCore.decorate;
            $decorator = _mirukenCore.$decorator;
            $decorate = _mirukenCore.$decorate;
            $decorated = _mirukenCore.$decorated;
            StrictProtocol = _mirukenCore.StrictProtocol;
            Flags = _mirukenCore.Flags;
            Delegate = _mirukenCore.Delegate;
            Resolving = _mirukenCore.Resolving;
        }],
        execute: function () {
            _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
                return typeof obj;
            } : function (obj) {
                return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
            };
            _definitions = {};

            _export('$handle', $handle = $define('$handle', Variance.Contravariant));

            _export('$handle', $handle);

            _export('$provide', $provide = $define('$provide', Variance.Covariant));

            _export('$provide', $provide);

            _export('$lookup', $lookup = $define('$lookup', Variance.Invariant));

            _export('$lookup', $lookup);

            _export('$NOT_HANDLED', $NOT_HANDLED = Object.freeze({}));

            _export('$NOT_HANDLED', $NOT_HANDLED);

            function $define(tag, variance) {
                if (!$isString(tag) || tag.length === 0 || /\s/.test(tag)) {
                    throw new TypeError("The tag must be a non-empty string with no whitespace.");
                } else if (_definitions[tag]) {
                    throw new TypeError('\'' + tag + '\' is already defined.');
                }

                var handled = void 0,
                    comparer = void 0;
                variance = variance || Variance.Contravariant;
                if (!(variance instanceof Variance)) {
                    throw new TypeError("Invalid variance type supplied");
                }

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
                        throw new TypeError('Incomplete \'' + tag + '\' definition: missing handler for constraint ' + constraint);
                    } else if (removed && !$isFunction(removed)) {
                        throw new TypeError("The removed argument is not a function.");
                    }
                    if (!$isFunction(handler)) {
                        if ($copy.test(handler)) {
                            var source = Modifier.unwrap(handler);
                            if (!$isFunction(source.copy)) {
                                throw new Error("$copy requires the target to have a copy method.");
                            }
                            handler = source.copy.bind(source);
                        } else {
                            var _source = $use.test(handler) ? Modifier.unwrap(handler) : handler;
                            handler = $lift(_source);
                        }
                    }
                    var meta = $meta(owner),
                        node = new Node(constraint, handler, removed),
                        index = createIndex(node.constraint),
                        list = meta[tag] || (meta[tag] = new IndexedList(comparer));
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
                    var meta = $meta(owner),
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
                        if ($eq.test(constraint)) {
                            v = Variance.Invariant;
                        }
                        constraint = Modifier.unwrap(constraint);
                        if (typeOf(constraint) === 'object') {
                            constraint = $classOf(constraint);
                        }
                    }

                    var ok = traverse(delegate);
                    if (!ok || all) ok = traverse(handler) || ok;

                    function traverse(target) {
                        if (!target) return false;
                        var ok = false,
                            meta = $meta(target);
                        if (meta) {
                            meta.traverseTopDown(function (m) {
                                ok = _dispatch(target, m, callback, constraint, v, composer, all, results) || ok;
                                if (ok && !all) return true;
                            });
                        }
                        return ok;
                    }

                    return ok;
                };
                function _dispatch(target, meta, callback, constraint, v, composer, all, results) {
                    var dispatched = false;
                    var invariant = v === Variance.Invariant,
                        index = createIndex(constraint),
                        list = meta[tag];
                    if (list && (!invariant || index)) {
                        var node = list.getIndex(index) || list.head;
                        while (node) {
                            if (node.match(constraint, v)) {
                                var result = node.handler.call(target, callback, composer);
                                if (handled(result)) {
                                    if (results) {
                                        results.call(callback, result);
                                    }
                                    if (!all) return true;
                                    dispatched = true;
                                }
                            } else if (invariant) {
                                break;
                            }
                            node = node.next;
                        }
                    }
                    return dispatched;
                }
                definition.tag = tag;
                definition.variance = variance;
                Object.freeze(definition);
                _definitions[tag] = definition;
                return definition;
            }

            _export('$define', $define);

            function Node(constraint, handler, removed) {
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
            _export('Node', Node);

            _export('$composer', $composer = void 0);

            _export('$composer', $composer);

            _export('HandleMethod', HandleMethod = Base.extend({
                constructor: function constructor(methodType, protocol, methodName, args, strict) {
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
                            if (!target || strict && protocol && !protocol.adoptedBy(target)) {
                                return false;
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
                                _export('$composer', $composer = composer);
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
                                if (result === $NOT_HANDLED) {
                                    return false;
                                }
                                _returnValue = result;
                                return true;
                            } catch (exception) {
                                _exception = exception;
                                throw exception;
                            } finally {
                                _export('$composer', $composer = oldComposer);
                            }
                        }
                    });
                }
            }));

            _export('HandleMethod', HandleMethod);

            _export('ResolveMethod', ResolveMethod = HandleMethod.extend({
                constructor: function constructor(methodType, protocol, methodName, args, strict, all, required) {
                    this.base(methodType, protocol, methodName, args, strict);
                    this.extend({
                        invokeResolve: function invokeResolve(composer) {
                            var _this = this;

                            var handled = false,
                                targets = composer.resolveAll(protocol);

                            if ($isPromise(targets)) {
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
            }));

            _export('ResolveMethod', ResolveMethod);

            _export('Lookup', Lookup = Base.extend({
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
            }));

            _export('Lookup', Lookup);

            _export('Deferred', Deferred = Base.extend({
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
                                    _result = Promise.resolve(_pending[0]).then(True);
                                } else if (_pending.length > 1) {
                                    _result = Promise.all(_pending).then(True);
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
            }));

            _export('Deferred', Deferred);

            _export('Resolution', Resolution = Base.extend({
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
                                    _result = this.instant ? $flatten(_resolutions, true) : Promise.all(_resolutions).then(function (res) {
                                        return $flatten(res, true);
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
                            var promised = $isPromise(resolution);
                            if (!_instant || !promised) {
                                _promised = _promised || promised;
                                if (promised && many) {
                                    resolution = resolution.catch(Undefined);
                                }
                                _resolutions.push(resolution);
                                _result = undefined;
                            }
                        }
                    });
                }
            }));

            _export('Resolution', Resolution);

            _export('Composition', Composition = Base.extend({
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
            }));

            _export('Composition', Composition);

            function RejectedError(callback) {
                this.callback = callback;

                if (Error.captureStackTrace) {
                    Error.captureStackTrace(this, this.constructor);
                } else {
                    Error.call(this);
                }
            }

            _export('RejectedError', RejectedError);

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

            _export('TimeoutError', TimeoutError);

            TimeoutError.prototype = new Error();
            TimeoutError.prototype.constructor = TimeoutError;

            function addDefinition(def, allowGets) {
                return function (target, key, descriptor, constraints) {
                    if (def && def.tag && key !== 'constructor') {
                        var lateBinding = function lateBinding() {
                            var result = this[key];
                            if ($isFunction(result)) {
                                return result.apply(this, arguments);
                            }
                            return allowGets ? result : $NOT_HANDLED;
                        };

                        if (constraints.length === 0) {
                            constraints = null;
                        }
                        def(target, constraints, lateBinding);
                    }
                    return descriptor;
                };
            }

            _export('addDefinition', addDefinition);

            function handle() {
                for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments[_key];
                }

                return decorate(addDefinition($handle), args);
            }

            _export('handle', handle);

            function provide() {
                for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                    args[_key2] = arguments[_key2];
                }

                return decorate(addDefinition($provide, true), args);
            }

            _export('provide', provide);

            function lookup() {
                for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                    args[_key3] = arguments[_key3];
                }

                return decorate(addDefinition($lookup, true), args);
            }

            _export('lookup', lookup);

            _export('CallbackHandler', CallbackHandler = Base.extend((_dec = handle(Lookup), _dec2 = handle(Deferred), _dec3 = handle(Resolution), _dec4 = handle(HandleMethod), _dec5 = handle(ResolveMethod), _dec6 = handle(Composition), (_obj = {
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
                    return $handle.dispatch(this, callback, null, composer, greedy);
                },
                _lookup: function _lookup(lookup, composer) {
                    return $lookup.dispatch(this, lookup, lookup.key, composer, lookup.isMany, lookup.addResult);
                },
                _defered: function _defered(deferred, composer) {
                    return $handle.dispatch(this, deferred.callback, null, composer, deferred.isMany, deferred.track);
                },
                _resolution: function _resolution(resolution, composer) {
                    var key = resolution.key,
                        many = resolution.isMany;
                    var resolved = $provide.dispatch(this, resolution, key, composer, many, resolution.resolve);
                    if (!resolved) {
                        var implied = new Node(key),
                            _delegate = this.delegate;
                        if (_delegate && implied.match($classOf(_delegate), Variance.Contravariant)) {
                            resolution.resolve($decorated(_delegate, true));
                            resolved = true;
                        }
                        if ((!resolved || many) && implied.match($classOf(this), Variance.Contravariant)) {
                            resolution.resolve($decorated(this, true));
                            resolved = true;
                        }
                    }
                    return resolved;
                },
                _handleMethod: function _handleMethod(method, composer) {
                    return method.invokeOn(this.delegate, composer) || method.invokeOn(this, composer);
                },
                _resolveMethod: function _resolveMethod(method, composer) {
                    return method.invokeResolve(composer);
                },
                _composition: function _composition(composable, composer) {
                    var callback = composable.callback;
                    return callback && $handle.dispatch(this, callback, null, composer);
                }
            }, (_applyDecoratedDescriptor(_obj, '_lookup', [_dec], Object.getOwnPropertyDescriptor(_obj, '_lookup'), _obj), _applyDecoratedDescriptor(_obj, '_defered', [_dec2], Object.getOwnPropertyDescriptor(_obj, '_defered'), _obj), _applyDecoratedDescriptor(_obj, '_resolution', [_dec3], Object.getOwnPropertyDescriptor(_obj, '_resolution'), _obj), _applyDecoratedDescriptor(_obj, '_handleMethod', [_dec4], Object.getOwnPropertyDescriptor(_obj, '_handleMethod'), _obj), _applyDecoratedDescriptor(_obj, '_resolveMethod', [_dec5], Object.getOwnPropertyDescriptor(_obj, '_resolveMethod'), _obj), _applyDecoratedDescriptor(_obj, '_composition', [_dec6], Object.getOwnPropertyDescriptor(_obj, '_composition'), _obj)), _obj)), {
                coerce: function coerce(object) {
                    return new this(object);
                }
            }));

            _export('CallbackHandler', CallbackHandler);

            Base.implement({
                toCallbackHandler: function toCallbackHandler() {
                    return CallbackHandler(this);
                }
            });

            compositionScope = $decorator({
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

            _export('CascadeCallbackHandler', CascadeCallbackHandler = CallbackHandler.extend({
                constructor: function constructor(handler, cascadeToHandler) {
                    if ($isNothing(handler)) {
                        throw new TypeError("No handler specified.");
                    } else if ($isNothing(cascadeToHandler)) {
                        throw new TypeError("No cascadeToHandler specified.");
                    }
                    Object.defineProperties(this, {
                        handler: {
                            value: handler.toCallbackHandler(),
                            writable: false
                        },

                        cascadeToHandler: {
                            value: cascadeToHandler.toCallbackHandler(),
                            writable: false
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
            }));

            _export('CascadeCallbackHandler', CascadeCallbackHandler);

            _export('CompositeCallbackHandler', CompositeCallbackHandler = CallbackHandler.extend({
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

                            handlers = $flatten(handlers, true).map(function (h) {
                                return h.toCallbackHandler();
                            });
                            _handlers.push.apply(_handlers, _toConsumableArray(handlers));
                            return this;
                        },
                        insertHandlers: function insertHandlers(atIndex) {
                            for (var _len6 = arguments.length, handlers = Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
                                handlers[_key6 - 1] = arguments[_key6];
                            }

                            handlers = $flatten(handlers, true).map(function (h) {
                                return h.toCallbackHandler();
                            });
                            _handlers.splice.apply(_handlers, [atIndex].concat(_toConsumableArray(handlers)));
                            return this;
                        },
                        removeHandlers: function removeHandlers() {
                            for (var _len7 = arguments.length, handlers = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
                                handlers[_key7] = arguments[_key7];
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
            }));

            _export('CompositeCallbackHandler', CompositeCallbackHandler);

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
                if (!$isString(methodName) || methodName.length === 0 || !methodName.trim()) {
                    throw new TypeError("No methodName specified.");
                } else if (!$isFunction(method)) {
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
                    return $decorate(this, decorations);
                },
                filter: function filter(_filter, reentrant) {
                    if (!$isFunction(_filter)) {
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

                                if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
                            } else if (test === false) {
                                throw new RejectedError(callback);
                            }
                        }
                        return aspectProceed(callback, composer, proceed, after);
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
                    for (var _len8 = arguments.length, handlers = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
                        handlers[_key8] = arguments[_key8];
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
            _export('Batching', Batching = StrictProtocol.extend({
                complete: function complete(composer) {}
            }));

            _export('Batching', Batching);

            BatchingComplete = Batching.extend();

            _export('Batcher', Batcher = CompositeCallbackHandler.extend(BatchingComplete, {
                constructor: function constructor() {
                    for (var _len9 = arguments.length, protocols = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
                        protocols[_key9] = arguments[_key9];
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
            }));

            _export('Batcher', Batcher);

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

            _export('InvocationOptions', InvocationOptions = Flags({
                None: 0,

                Broadcast: 1 << 0,

                BestEffort: 1 << 1,

                Strict: 1 << 2,

                Resolve: 1 << 3,

                Notify: 1 << 0 | 1 << 1
            }));

            _export('InvocationOptions', InvocationOptions);

            _export('InvocationSemantics', InvocationSemantics = Composition.extend({
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
            }));

            _export('InvocationSemantics', InvocationSemantics);

            _export('InvocationDelegate', InvocationDelegate = Delegate.extend({
                constructor: function constructor(handler) {
                    this.extend({
                        get handler() {
                            return handler;
                        }
                    });
                },
                get: function get(protocol, propertyName, strict) {
                    return delegate(this, MethodType.Get, protocol, propertyName, null, strict);
                },
                set: function set(protocol, propertyName, propertyValue, strict) {
                    return delegate(this, MethodType.Set, protocol, propertyName, propertyValue, strict);
                },
                invoke: function invoke(protocol, methodName, args, strict) {
                    return delegate(this, MethodType.Invoke, protocol, methodName, args, strict);
                }
            }));

            _export('InvocationDelegate', InvocationDelegate);

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
        }
    };
});