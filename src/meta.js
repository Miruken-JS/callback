import {
    False, True, Undefined, Base, Abstract, extend,
    typeOf, assignID, Variance, $meta, $isNothing,
    $isString, $isFunction, $isObject, $isClass,
    $isProtocol, $classOf, Modifier, IndexedList,
    $eq, $use, $copy, $lift
} from 'miruken-core';

const _definitions = {};

/**
 * Definition for handling callbacks contravariantly.
 * @method $handle
 */
export const $handle = $define('$handle', Variance.Contravariant);
/**
 * Definition for providing callbacks covariantly.
 * @method $provide  
 */        
export const $provide = $define('$provide', Variance.Covariant);
/**
 * Definition for matching callbacks invariantly.
 * @method $lookup  
 */                
export const $lookup = $define('$lookup', Variance.Invariant);
/**
 * return value to indicate a callback was not handled.
 * @property {Object} $NOT_HANDLED
 */                
export const $NOT_HANDLED = Object.freeze({});

/**
 * Defines a new handler grouping.
 * This is the main extensibility point for handling callbacks.
 * @method $define
 * @param   {string}    tag       - group tag
 * @param   {Variance}  variance  - group variance
 * @return  {Function}  function to add to a group.
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
            if ($isObject(constraint)) {
                constraint = $classOf(constraint);
            }
        }

        let ok = traverse(delegate);
        if (!ok || all)
            ok = traverse(handler) || ok;
             
        function traverse(target) {
            if (!target) return false;
            let ok   = false,
                meta = $meta(target);
            if (meta) {
                meta.traverseTopDown(m => {
                    ok = _dispatch(target, m, callback, constraint, v, composer, all, results) || ok;
                    if (ok && !all) return true;
                });
            }
            return ok;
        }
        
        return ok;
    };
    function _dispatch(target, meta, callback, constraint, v, composer, all, results) {
        let   dispatched = false;
        const invariant  = (v === Variance.Invariant),
              index      = createIndex(constraint),
              list       = meta[tag];
        if (list && (!invariant || index)) {
            let node = list.getIndex(index) || list.head;
            while (node) {
                if (node.match(constraint, v)) {
                    const result = node.handler.call(target, callback, composer);
                    if (handled(result)) {
                        if (results) {
                            results.call(callback, result);
                        }
                        if (!all) return true;
                        dispatched = true;
                    }
                } else if (invariant) {
                    break;  // stop matching if invariant not satisifed
                }
                node = node.next;
            }
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
