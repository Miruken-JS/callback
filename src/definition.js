import {
    False, Undefined, Base, Variance,
    Metadata, Modifier, IndexedList, assignID,
    $isNothing, $isString, $isFunction, $isObject,
    $isClass, $isProtocol, $classOf, $eq, $use,
    $lift
} from "miruken-core";

const definitions = {};

/**
 * Definition for handling callbacks contravariantly.
 * @property {Function} $handle
 */
export const $handle = $define(Variance.Contravariant);

/**
 * Definition for providing callbacks covariantly.
 * @property {Function} $provide  
 */        
export const $provide = $define(Variance.Covariant);

/**
 * Definition for matching callbacks invariantly.
 * @property {Function} $lookup  
 */                
export const $lookup = $define(Variance.Invariant);

/**
 * Indicates a callback was not handled.
 * @property {Function} $unhandled
 */                
export function $unhandled(result) {
    return result === $unhandled;
}

/**
 * Defines a new handler grouping.
 * This is the main extensibility point for handling callbacks.
 * @method $define
 * @param   {Variance}  [variance=Variance.Contravariant]  -  group variance
 * @return  {Function}  function to register with group
 */
export function $define(variance) {
    variance = variance || Variance.Contravariant;
    if (!(variance instanceof Variance)) {
        throw new TypeError("$define expects a Variance parameter");
    }

    const key = Symbol();
    let handled, comparer;
    
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
                `Incomplete definition: missing handler for constraint ${constraint}`);
        } else if (removed && !$isFunction(removed)) {
            throw new TypeError("The removed argument is not a function.");
        }
        if (!$isFunction(handler)) {
            const source = $use.test(handler) ? Modifier.unwrap(handler) : handler;
            handler = $lift(source);
        }
        const binding = new Binding(constraint, handler, removed),
              index   = createIndex(binding.constraint),
              list    = Metadata.getOrCreateOwn(key, owner, () => new IndexedList(comparer));
        list.insert(binding, index);
        return function (notifyRemoved) {
            list.remove(binding);
            if (list.isEmpty()) {
                Metadata.remove(key, owner);
            }
            if (binding.removed && (notifyRemoved !== false)) {
                binding.removed(owner);
            }
        };
    };
    definition.removeAll = function (owner) {
        const list = Metadata.getOwn(key, owner);
        if (!list) { return };
        let   head = list.head;
        while (head) {
            if (head.removed) {
                head.removed(owner);
            }
            head = head.next;
        }
        Metadata.remove(key, owner);
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

        let dispatched = dispatch(delegate);
        if (!dispatched || all) {
            dispatched = dispatch(handler) || dispatched;
        }
             
        function dispatch(target) {
            let dispatched = false;
            if (target) {
                Metadata.collect(key, target, list => {
                    dispatched = _dispatch(target, callback, constraint, v,
                                           list, composer, all, results)
                              || dispatched;
                    return dispatched && !all;
                });
            }
            return dispatched;
        }

        if (!dispatched) { return $unhandled; }
    };
    function _dispatch(target, callback, constraint, v, list, composer, all, results) {
        let   dispatched = false;
        const invariant  = (v === Variance.Invariant),
              index      = createIndex(constraint);
        if (!invariant || index) {
            let binding = list.getFirst(index) || list.head;
            while (binding) {
                if (binding.match(constraint, v)) {
                    const result = binding.handler.call(target, callback, composer);
                    if (handled(result)) {
                        if (results) {
                            results.call(callback, result);
                        }
                        if (!all) { return true; }
                        dispatched = true;
                    }
                } else if (invariant) {
                    break;  // stop matching if invariant not satisifed
                }
                binding = binding.next;
            }
        }
        return dispatched;
    }
    definition.key      = key;
    definition.variance = variance;
    Object.freeze(definition);
    return definitions[key] = definition;
}

export function Binding(constraint, handler, removed) {
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
Binding.prototype.equals = function (other) {
    return this.constraint === other.constraint
        && (this.handler === other.handler ||
            this.handler.key === other.handler.key);
}

function createIndex(constraint) {
    if (!constraint) { return; }
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
    const constraint = this.constraint;
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
    const constraint = this.constraint;
    if (constraint === match) { return true; }
    if (variance === Variance.Contravariant) {
        return match.prototype instanceof constraint;
    }
    if (variance === Variance.Covariant) {
        return match.prototype &&
            (constraint.prototype instanceof match
             || ($isProtocol(match) && match.isAdoptedBy(constraint)));
    }
    return false;
}

function matchString(match) {
    return $isString(match) && this.constraint == match;
}

function matchRegExp(match, variance) {
    return (variance !== Variance.Invariant) && this.constraint.test(match);
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
    return ((result != null) && (result !== $unhandled));
}

function impliesSuccess(result) {
    return result !== $unhandled;
}
