import {
    False, Undefined, Base, Variance,
    Metadata, Modifier, IndexedList, assignID,
    decorate, isDescriptor, designWithReturn,
    $isNothing, $isString, $isFunction, $isObject,
    $isClass, $isProtocol, $classOf, $eq, $use, $lift
} from "miruken-core";

import { $unhandled } from "./callback";

const policies = {};

/**
 * Policy for handling callbacks contravariantly.
 * @property {Function} $handle
 */
export const $handle = $policy(Variance.Contravariant, "handle");

export function handles(...args) {
    return decorate(addPolicy("handle", $handle), args);
}

/**
 * Policy for providing callbacks covariantly.
 * @property {Function} $provide  
 */        
export const $provide = $policy(Variance.Covariant, "provide");

export function provides(...args) {
    return decorate(addPolicy("provide", $provide, true), args);
}

/**
 * Policy for matching callbacks invariantly.
 * @property {Function} $lookup  
 */                
export const $lookup = $policy(Variance.Invariant, "lookup");

export function looksup(...args) {
    return decorate(addPolicy("lookup", $lookup, true), args);    
}

/**
 * Marks methods and properties as handlers.
 * @method addPolicy
 * @param  {String}    name         - policy name
 * @param  {Object}    provider     - policy provider
 * @param  {Object}    [allowGets]  - true to allow property handlers
 * @param  {Function}  [filter]     - optional callback filter
 */
export function addPolicy(name, provider, allowGets, filter) {
    if (!provider) {
        throw new Error(`Provider for @${name} is required`);
    }
    return (target, key, descriptor, constraints) => {
        if (!isDescriptor(descriptor)) {
            throw new SyntaxError(`@${name} cannot be applied to classes`);
        }
        if (key === "constructor") {
            throw new SyntaxError(`@${name} cannot be applied to constructors`);
        }
        const { get, value } = descriptor;
        if (!$isFunction(value)) {
            if (allowGets) {
                if (!$isFunction(get)) {
                    throw new SyntaxError(`@${name} can only be applied to methods and getters`);
                }
            } else {
                throw new SyntaxError(`@${name} can only be applied to methods`);
            }
        }
        if (constraints.length == 0) {
            if (provider.variance === Variance.Covariant ||
                provider.variance === Variance.Invariant) {
                const signature = designWithReturn.get(target, key);
                constraints = signature ? signature[0] : null;
            } else {
                constraints = null;
            }
        }
        function lateBinding() {
            const result = this[key];
            if ($isFunction(result)) {
                return result.apply(this, arguments);
            }
            return allowGets ? result : $unhandled;
        }
        const handler = $isFunction(filter) ? function () {
            return filter.apply(this, [key, ...arguments]) === false
                 ? $unhandled
                 : lateBinding.apply(this, arguments);
            } : lateBinding;
        handler.key = key;
        provider(target, constraints, handler);
    };
}

/**
 * Defines a new callback policy.
 * This is the main extensibility point for handling callbacks.
 * @method $policy
 * @param   {Variance}  [variance=Variance.Contravariant]  -  policy variance 
 * @param   {Object}    description                        -  policy description
 * @return  {Function}  function to register with policy
 */
export function $policy(variance, description) {
    if (description == null) {
        throw new Error("$policy requires a description");
    }

    variance = variance || Variance.Contravariant;
    if (!(variance instanceof Variance)) {
        throw new TypeError("$policy expects a Variance parameter");
    }

    const key = Symbol(description);
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

    function policy(owner, constraint, handler, removed) {
        if (Array.isArray(constraint)) {
            if (constraint.length == 1) {
                constraint = constraint[0];
            } else {
                return constraint.reduce((result, c) => {
                    const undefine = _policy(owner, c, handler, removed);
                    return notifyRemoved => {
                        result(notifyRemoved);
                        undefine(notifyRemoved);
                    };
                }, Undefined);
            }
        }
        return _policy(owner, constraint, handler, removed);
    }
    function _policy(owner, constraint, handler, removed) {
        if ($isNothing(owner)) {
            throw new TypeError("Policies must have an owner.");
        } else if ($isNothing(handler)) {
            handler    = constraint;
            constraint = $classOf(Modifier.unwrap(constraint));
        }
        if ($isNothing(handler)) {
            throw new TypeError(
                `Incomplete policy: missing handler for constraint ${constraint}`);
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
    policy.removeAll = function (owner) {
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
    policy.dispatch = function (handler, callback, constraint, composer, all, results) {
        let v = variance;
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

        let dispatched = false;

        Metadata.collect(key, handler, list => {
            dispatched = _dispatch(handler, callback, constraint, v,
                                   list, composer, all, results)
                      || dispatched;
            return dispatched && !all;
        });

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
                        if (!results || results.call(callback, result, composer) !== false) {
                            if (!all) { return true; }
                            dispatched = true;
                        }
                    }
                } else if (invariant) {
                    break;  // stop matching if invariant not satisifed
                }
                binding = binding.next;
            }
        }
        return dispatched;
    }
    policy.key         = key;
    policy.description = description;
    policy.variance    = variance;
    Object.freeze(policy);
    return policies[key] = policy;
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
            (this.handler.key && other.handler.key &&
             this.handler.key === other.handler.key));
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
        return !$isString(match) && constraint.isAdoptedBy(match);
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

function matchString(match, variance) {
    if (!$isString(match)) { return false;}
    return variance === Variance.Invariant
         ? this.constraint == match
         : this.constraint.toLowerCase() == match.toLowerCase();
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
