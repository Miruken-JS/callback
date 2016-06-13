define(["exports", "miruken-core"], function (exports, _mirukenCore) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.$define = $define;
    function $define(tag, variance) {
        if (!$isString(tag) || tag.length === 0 || /\s/.test(tag)) {
            throw new TypeError("The tag must be a non-empty string with no whitespace.");
        } else if (_definitions[tag]) {
            throw new TypeError(format("'%1' is already defined.", tag));
        }

        var handled, comparer;
        variance = variance || Variance.Contravariant;
        if (!(variance instanceof Variance)) {
            throw new TypeError("Invalid variance type supplied");
        }
        switch (variance) {
            case Variance.Covariant:
                handled = _requiresResult;
                comparer = _compareCovariant;
                break;
            case Variance.Contravariant:
                handled = _impliesSuccess;
                comparer = _compareContravariant;
                break;
            case Variance.Invariant:
                handled = _requiresResult;
                comparer = _compareInvariant;
                break;
        }

        function definition(owner, constraint, handler, removed) {
            if ($isArray(constraint)) {
                return Array2.reduce(constraint, function (result, c) {
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
            if ($isNothing(owner)) {
                throw new TypeError("Definitions must have an owner.");
            } else if ($isNothing(handler)) {
                handler = constraint;
                constraint = $classOf(Modifier.unwrap(constraint));
            }
            if ($isNothing(handler)) {
                throw new TypeError(format("Incomplete '%1' definition: missing handler for constraint %2.", tag, constraint));
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
                    var source = $use.test(handler) ? Modifier.unwrap(handler) : handler;
                    handler = $lift(source);
                }
            }
            var meta = owner.$meta,
                node = new _Node(constraint, handler, removed),
                index = _createIndex(node.constraint),
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
            var meta = owner.$meta;
            var list = meta[tag],
                head = list.head;
            while (head) {
                if (head.removed) {
                    head.removed(owner);
                }
                head = head.next;
            }
            delete meta[tag];
        };
        definition.dispatch = function (handler, callback, constraint, composer, all, results) {
            var v = variance,
                delegate = handler.delegate;
            constraint = constraint || callback;
            if (constraint) {
                if ($eq.test(constraint)) {
                    v = Variance.Invariant;
                }
                constraint = Modifier.unwrap(constraint);
                if ((0, _mirukenCore.typeOf)(constraint) === 'object') {
                    constraint = $classOf(constraint);
                }
            }
            var ok = delegate && _dispatch(delegate, delegate.$meta, callback, constraint, v, composer, all, results);
            if (!ok || all) {
                ok = ok || _dispatch(handler, handler.$meta, callback, constraint, v, composer, all, results);
            }
            return ok;
        };
        function _dispatch(target, meta, callback, constraint, v, composer, all, results) {
            var dispatched = false,
                invariant = v === Variance.Invariant,
                index = meta && _createIndex(constraint);
            while (meta) {
                var list = meta[tag];
                if (list && (!invariant || index)) {
                    var node = list.getIndex(index) || list.head;
                    while (node) {
                        if (node.match(constraint, v)) {
                            var base = target.base,
                                baseCalled = false;
                            target.base = function () {
                                var baseResult;
                                baseCalled = true;
                                _dispatch(target, meta.getParent(), callback, constraint, v, composer, false, function (result) {
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
                meta = meta.getParent();
            }
            return dispatched;
        }
        _definitions[tag] = definition;
        return definition;
    }

    function _Node(constraint, handler, removed) {
        var invariant = $eq.test(constraint);
        constraint = Modifier.unwrap(constraint);
        this.constraint = constraint;
        this.handler = handler;
        if ($isNothing(constraint)) {
            this.match = invariant ? _mirukenCore.False : _matchEverything;
        } else if ($isProtocol(constraint)) {
            this.match = invariant ? _matchInvariant : _matchProtocol;
        } else if ($isClass(constraint)) {
            this.match = invariant ? _matchInvariant : _matchClass;
        } else if ($isString(constraint)) {
            this.match = _matchString;
        } else if (instanceOf(constraint, RegExp)) {
            this.match = invariant ? _mirukenCore.False : _matchRegExp;
        } else if ($isFunction(constraint)) {
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
            if ($isString(constraint)) {
                return constraint;
            } else if ($isFunction(constraint)) {
                return assignID(constraint);
            }
        }
    }

    function _matchInvariant(match) {
        return this.constraint === match;
    }

    function _matchEverything(match, variance) {
        return variance !== Variance.Invariant;
    }

    function _matchProtocol(match, variance) {
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

    function _matchClass(match, variance) {
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

    function _matchString(match) {
        return $isString(match) && this.constraint == match;
    }

    function _matchRegExp(match, variance) {
        return variance !== Variance.Invariant && this.constraint.test(match);
    }

    function _compareCovariant(node, insert) {
        if (insert.match(node.constraint, Variance.Invariant)) {
            return 0;
        } else if (insert.match(node.constraint, Variance.Covariant)) {
            return -1;
        }
        return 1;
    }

    function _compareContravariant(node, insert) {
        if (insert.match(node.constraint, Variance.Invariant)) {
            return 0;
        } else if (insert.match(node.constraint, Variance.Contravariant)) {
            return -1;
        }
        return 1;
    }

    function _compareInvariant(node, insert) {
        return insert.match(node.constraint, Variance.Invariant) ? 0 : -1;
    }

    function _requiresResult(result) {
        return result !== null && result !== undefined && result !== $NOT_HANDLED;
    }

    function _impliesSuccess(result) {
        return result ? result !== $NOT_HANDLED : result === undefined;
    }

    function _flattenPrune(array) {
        var i = 0,
            flatten = function flatten(result, item) {
            if (Array2.like(item)) {
                Array2.reduce(item, flatten, result);
            } else if (item != null) {
                result[i++] = item;
            }
            return result;
        };
        return Array2.reduce(array, flatten, []);
    }
});