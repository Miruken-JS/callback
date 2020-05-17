import { 
    Base, Variance, IndexedList, Metadata,
    $isNothing, $eq, $contents, $isFunction,
    $isString, $isProtocol, $isClass, $classOf,
    $isObject, assignID, createKey
} from "miruken-core";

import { CallbackPolicy } from "./callback-policy";
import StaticHandler from "./static-handler";

const _ = createKey(),
      descriptorMetadataKey = Symbol("descriptor-metadata");

export const HandlerDescriptor = Base.extend({
    constructor(owner) {
        if ($isNothing(owner)) {
            throw new Error("The owner argument is required.");
        }
        _(this).owner    = owner;
        _(this).bindings = new Map();
    },

    get owner()    { return _(this).owner; },
    get policies() { return [..._(this).bindings.keys()]; },
    get bindings() { return [..._(this).bindings.entries()]; },

    getBindings(policy) {
        requireValidPolicy(policy);
        return _(this).bindings.get(policy);
    },
    addBinding(policy, constraint, handler, removed) {
        requireValidPolicy(policy);
        const binding  = Binding.create(constraint, handler, removed);
        return addBinding.call(this, policy, binding);
    },
    removeBindings(policy) {
        requireValidPolicy(policy);

        const owner          = _(this).owner,
              bindings       = _(this).bindings,
              policyBindings = bindings.get(policy);
        if (policyBindings == null) return;

        for (let binding of policyBindings) {
            if (binding.removed) {
                binding.removed(owner);
            }
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
            constraint = $contents(constraint);
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
    },

    /**
     * Metadata management methods.
     * The following methods are used to support the metadata
     * system when base2 classes are used.  The instance and
     * static object literals will be decorated first so it
     * is necessary to copy or merge their metadata on to
     * the correct classes or prototypes.
     */

    copyMetadata(sourceDescriptor, target, source) {
        const targetDescriptor = HandlerDescriptor.get(target, true);
         for (let [policy, bindings] of sourceDescriptor.bindings) {
            for (let binding of bindings) {
                addBinding.call(targetDescriptor, policy, binding.copy());
            }
        }
        return targetDescriptor;
    },
    mergeMetadata(sourceDescriptor) {
        if (sourceDescriptor.constructor !== this.constructor) {
            throw new TypeError("mergeMetadata expects a HandlerDescriptor.");
        }
        for (let [policy, bindings] of sourceDescriptor.bindings) {
            for (let binding of bindings) {
                addBinding.call(this, policy, binding.copy());
            }
        }
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

function addBinding(policy, binding) {
    const owner    = _(this).owner,
          bindings = _(this).bindings,
          index    = createIndex(binding.constraint);
    
    let policyBindings = bindings.get(policy);
    if (policyBindings == null) {
        policyBindings = new IndexedList(policy.compareBinding.bind(policy));
        bindings.set(policy, policyBindings);
    }

    policyBindings.insert(binding, index);

    return function (notifyRemoved) {
        policyBindings.remove(binding);
        if (policyBindings.isEmpty) {
            bindings.delete(policy);
        }
        if ($isFunction(binding.removed) && (notifyRemoved !== false)) {
            binding.removed(owner);
        }
    };
}

function dispatch(policy, target, callback, constraint, index,
                  variance, bindings, composer, all, results) {
    let dispatched  = false;
    const invariant = (variance === Variance.Invariant);
    if (!invariant || index) {
        for (let binding of bindings.fromIndex(index)) {
            if (binding.match(constraint, variance)) {
                let guard;
                if ($isFunction(callback.guardDispatch)) {
                    guard = callback.guardDispatch(target, binding);
                    if (!guard) continue;
                }
                try {
                    const result = binding.handler.call(
                        target, callback, composer, { constraint, binding });
                    if (policy.acceptResult(result)) {
                        if (!results || results.call(callback, result, composer) !== false) {
                            if (!all) return true;
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
        }
    }
    return dispatched;
}

function requireValidPolicy(policy) {
    if ($isNothing(policy)) {
        throw new Error("The policy argument is required.")
    }
    if (!(policy instanceof CallbackPolicy)) {
        throw new TypeError("The policy argument is not a valid CallbackPolicy.");
    }
}

// Binding Support

export const Binding = Base.extend({
    equals(other) {
        return this.constraint === other.constraint
            && (this.handler === other.handler ||
               (this.handler.key && other.handler.key &&
                this.handler.key === other.handler.key));
    },
    copy() {
        const binding = new this.constructor();
        binding.constraint = this.constraint;
        binding.handler    = this.handler;
        return binding;
    },   
    toString() {
        return `Binding | ${this.constraint}`;
    }
}, {
    create(constraint, handler, removed) {
        let binding;
        const invariant = $eq.test(constraint);
        constraint = $contents(constraint);
        if ($isNothing(constraint)) {
            binding = invariant ? new BindingMatchNone : new BindingMatchEverything;
        } else if ($isProtocol(constraint)) {
            binding = invariant ? new BindingMatchInvariant : new BindingMatchProtocol;
        } else if ($isClass(constraint)) {
            binding = invariant ? new BindingMatchInvariant : new BindingMatchClass;
        } else if ($isString(constraint)) {
            binding = new BindingMatchString;
        } else if (constraint instanceof RegExp) {
            binding = invariant ? new BindingMatchNone : new BindingMatchRegExp;
        } else if ($isFunction(constraint)) {
            binding = new BindingMatchCustom(constraint);
        } else {
            binding = new BindingMatchNone;
        }
        binding.constraint = constraint;
        binding.handler    = handler;
        if (removed) {
            binding.removed = removed;
        }
        return binding;
    }
});

const BindingMatchNone = Binding.extend({
    match() { return false; }
});

const BindingMatchInvariant = Binding.extend({
    match(match) {
        return this.constraint === match;
    }
});

const BindingMatchEverything = Binding.extend({
    match(match, variance) {
        return variance !== Variance.Invariant;
    }
});

const BindingMatchProtocol = Binding.extend({
    match(match, variance) {
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
});

const BindingMatchClass = Binding.extend({
    match(match, variance) {
        const constraint = this.constraint;
        if (constraint === match) return true;
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
})

const BindingMatchString = Binding.extend({
    match(match, variance) {
        if (!$isString(match)) return false;
        return variance === Variance.Invariant
             ? this.constraint == match
             : this.constraint.toLowerCase() == match.toLowerCase();   
    }
});

const BindingMatchRegExp = Binding.extend({
    match(match, variance) {
        return (variance !== Variance.Invariant) && this.constraint.test(match);
    }
});

const BindingMatchCustom = Binding.extend({
    constructor(match) {
        this.match = match;
    },

    copy() {
        const binding = new BindingMatchCustom(this.match);
        binding.constraint = this.constraint;
        binding.handler    = this.handler;
        return binding;
    },
});

function createIndex(constraint) {
    if ($isNothing(constraint)) return;
    if ($isString(constraint)) return constraint;
    if ($isFunction(constraint)) {
        return assignID(constraint);
    }
}

export default HandlerDescriptor;
