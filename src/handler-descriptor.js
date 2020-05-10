import { 
    Base, False, Variance, IndexedList,
    Metadata, Modifier, $isNothing, $eq,
    $isFunction, $isString, $isProtocol,
    $isClass, $classOf, $isObject, assignID,
    createKey
} from "miruken-core";

const _ = createKey(),
      descriptorMetadataKey = Symbol();

export const HandlerDescriptor = Base.extend({
    constructor(owner) {
        if ($isNothing(owner)) {
            throw new Error("The owner argument is required.");
        }
        _(this).owner    = owner;
        _(this).bindings = new Map();
    },

    get owner() { return _(this).owner; },

    getBindings(policy) {
        requireValidPolicy(policy);
        return _(this).bindings.get(policy);
    },
    addBinding(policy, constraint, handler, removed) {
        requireValidPolicy(policy);

        const owner    = _(this).owner,
              bindings = _(this).bindings,
              binding  = new Binding(constraint, handler, removed),
              index    = createIndex(binding.constraint);
        
        let policyBindings = bindings.get(policy);
        if (policyBindings == null) {
            policyBindings = new IndexedList(policy.compareBinding.bind(policy));
            bindings.set(policy, policyBindings);
        }

        policyBindings.insert(binding, index);

        return function (notifyRemoved) {
            policyBindings.remove(binding);
            if (policyBindings.isEmpty()) {
                bindings.delete(policy);
            }
            if ($isFunction(removed) && (notifyRemoved !== false)) {
                removed(owner);
            }
        };
    },
    removeBindings(policy) {
        requireValidPolicy(policy);

        const owner          = _(this).owner,
              bindings       = _(this).bindings,
              policyBindings = bindings.get(policy);
        if (policyBindings == null) return;

        let head = policyBindings.head;
        
        while (head) {
            if (head.removed) {
                head.removed(owner);
            }
            head = head.next;
        }

        bindings.delete(policy);
    },
    dispatch(policy, handler, callback, constraint, composer, all, results) {
        requireValidPolicy(policy);

        const variance = policy.variance;

        constraint = constraint || callback;
         
        if (constraint) {
            if ($eq.test(constraint)) {
                variance = Variance.Invariant;
            }
            constraint = Modifier.unwrap(constraint);
            if ($isObject(constraint)) {
                constraint = $classOf(constraint);
            }
        }

        const index = createIndex(constraint);

        let dispatched = false;
        Metadata.collect(descriptorMetadataKey, handler, descriptor => {
            const bindings = descriptor.getBindings(policy);
            if (bindings == null) return false;

            dispatched = dispatch(policy, handler, callback, constraint,
                                  index, variance, bindings, composer,
                                  all, results)
                      || dispatched;
            return dispatched && !all;
        });
        return dispatched; 
    }
}, {
    get(owner, create) {
        if (create) {
            return Metadata.getOrCreateOwn(
                descriptorMetadataKey, owner, () => new HandlerDescriptor(owner));
        }
        return Metadata.get(descriptorMetadataKey, owner);
    }
});

function dispatch(policy, target, callback, constraint, index,
                  variance, bindings, composer, all, results) {
    let dispatched  = false;
    const invariant = (variance === Variance.Invariant);
    if (!invariant || index) {
        let binding = bindings.getFirst(index) || bindings.head;
        while (binding) {
            if (binding.match(constraint, variance)) {
                let guard;
                if ($isFunction(callback.guardDispatch)) {
                    guard = callback.guardDispatch(target, binding);
                    if (!guard) {
                        binding = binding.next;
                        continue;
                    }
                }
                try {
                    const result = binding.handler.call(
                        target, callback, composer, { constraint, binding });
                    if (policy.acceptResult(result)) {
                        if (!results || results.call(callback, result, composer) !== false) {
                            if (!all) { return true; }
                            dispatched = true;
                        }
                    }
                } finally {
                    if ($isFunction(guard)) {
                        guard.call(callback);
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

function requireValidPolicy(policy) {
    if ($isNothing(policy)) {
        throw new Error("The policy argument is required.")
    }
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
Binding.prototype.toString = function () {
    return `Binding | ${this.constraint}`;
}

function createIndex(constraint) {
    if (!constraint) return;
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
    if (!$isString(match)) return false;
    return variance === Variance.Invariant
         ? this.constraint == match
         : this.constraint.toLowerCase() == match.toLowerCase();
}

function matchRegExp(match, variance) {
    return (variance !== Variance.Invariant) && this.constraint.test(match);
}

export default HandlerDescriptor;
