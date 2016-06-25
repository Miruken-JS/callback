import {
    False, True, Undefined, Base, Abstract, extend,
    typeOf, assignID, Variance, MetaMacro, Metadata,
    $isClass, $isString, $isFunction, $isNothing,
    $isProtocol, $classOf, Modifier, IndexedList,
    $eq, $use, $copy, $lift
} from 'miruken-core';

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
    },
    /**
     * Determines if the macro should be inherited
     * @method shouldInherit
     * @returns {boolean} true
     */                        
    shouldInherit: True,
    /**
     * Determines if the macro should be applied on extension.
     * @method isActive
     * @returns {boolean} true
     */ 
    isActive: True
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
        handled  = _requiresResult;
        comparer = _compareCovariant; 
        break;
    case Variance.Contravariant:
        handled  = _impliesSuccess;
        comparer = _compareContravariant; 
        break;
    case Variance.Invariant:
        handled  = _requiresResult;
        comparer = _compareInvariant; 
        break;
    }

    function definition(owner, constraint, handler, removed) {
        if (Array.isArray(constraint)) {
            return constraint.reduce((result, c) => {
                const undefine = _definition(owner, c, handler, removed);
                return notifyRemoved => {
                    result(notifyRemoved);
                    undefine(notifyRemoved);
                };
            }, Undefined);
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
        const meta  = owner[Metadata],
              node  = new Node(constraint, handler, removed),
              index = _createIndex(node.constraint),
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
        const meta = owner[Metadata],
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
        let ok = delegate && _dispatch(delegate, delegate[Metadata], callback, constraint, v, composer, all, results);
        if (!ok || all) {
            ok = ok || _dispatch(handler, handler[Metadata], callback, constraint, v, composer, all, results);
        }
        return ok;
    };
    function _dispatch(target, meta, callback, constraint, v, composer, all, results) {
        let   dispatched = false;
        const invariant  = (v === Variance.Invariant),
              index      = meta && _createIndex(constraint);
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
    _definitions[tag] = definition;
    return definition;
}

export function Node(constraint, handler, removed) {
    const invariant = $eq.test(constraint);
    constraint      = Modifier.unwrap(constraint);
    this.constraint = constraint;
    this.handler    = handler;
    if ($isNothing(constraint)) {
        this.match = invariant ? False : _matchEverything;
    } else if ($isProtocol(constraint)) {
        this.match = invariant ? _matchInvariant : _matchProtocol;
    } else if ($isClass(constraint)) {
        this.match = invariant ? _matchInvariant : _matchClass;
    } else if ($isString(constraint)) {
        this.match = _matchString;
    } else if (constraint instanceof RegExp) {
        this.match = invariant ? False : _matchRegExp;
    } else if ($isFunction(constraint)) {
        this.match = constraint;
    } else {
        this.match = False;
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

function _matchClass(match, variance) {
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

function _matchString(match) {
    return $isString(match) && this.constraint == match;
}

function _matchRegExp(match, variance) {
    return (variance !== Variance.Invariant) && this.constraint.test(match);
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
    return ((result !== null) && (result !== undefined) && (result !== $NOT_HANDLED));
}

function _impliesSuccess(result) {
    return result ? (result !== $NOT_HANDLED) : (result === undefined);
}
