import { 
    Base, Variance, Undefined, IndexedList,
    Metadata, $isNothing, $eq, $contents,
    $isFunction, $isString, $isProtocol,
    $isClass, $classOf, $isObject, assignID,
    createKey
} from "miruken-core";

import { CallbackPolicy } from "./callback-policy";

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
        const binding = Binding.create(constraint, handler, removed);
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
    dispatch(policy, handler, callback, constraint, composer, greedy, results) {
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
                                  greedy, results)
                      || dispatched;
            return dispatched && !greedy;
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

    copyMetadata(sourceDescriptor, target, source, sourceKey) {
        if (sourceKey) return;
        const targetDescriptor = HandlerDescriptor.get(target, true);
         for (let [policy, bindings] of sourceDescriptor.bindings) {
            for (let binding of bindings) {
                // Base2 classes can have constructor decorators.
                if (binding.constraint == "#constructor") {
                    const clazz       = $classOf(target),
                          constructor = Binding.create(clazz, binding.handler.bind(clazz));
                    addBinding.call(staticDescriptor, policy, constructor, true);
                } else {
                    addBinding.call(targetDescriptor, policy, binding.copy());
                }
            }
        }
        return targetDescriptor;
    },
    mergeMetadata(sourceDescriptor, target, source, sourceKey) {
        if ($classOf(sourceDescriptor) !== $classOf(this)) {
            throw new TypeError("mergeMetadata expects a HandlerDescriptor.");
        }
        if (sourceKey) return;
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
                descriptorMetadataKey, owner, () => new this(owner));
        }
        return Metadata.get(descriptorMetadataKey, owner);
    },
    remove(owner) {
        return Metadata.remove(descriptorMetadataKey, owner);
    }
});

const ownerSymbol      = Symbol();
const StaticHandler    = Base.extend();
const InferenceHandler = Base.extend({
    collect(_, { binding }) {

    }
});

const staticDescriptor    = HandlerDescriptor.get(StaticHandler, true);
const inferenceDescriptor = HandlerDescriptor.get(InferenceHandler, true);

Object.defineProperties(HandlerDescriptor, {
    StaticHandler:  {
        value:    StaticHandler,
        writable: false
    },         
    InferenceHandler: {
        value:    InferenceHandler,
        writable: false
    }
});

function addBinding(policy, binding, skipStatic, skipInference) {
    const owner    = _(this).owner,
          bindings = _(this).bindings,
          index    = createIndex(binding.constraint);
    
    let policyBindings = bindings.get(policy);
    if (policyBindings == null) {
        policyBindings = new IndexedList(policy.compareBinding.bind(policy));
        bindings.set(policy, policyBindings);
    }

    policyBindings.insert(binding, index);

    let removeStaticBinding;
    let removeInferenceBinding;

    if (!(skipStatic && skipInference)) {
        if ($isClass(owner)) {
            if (!skipStatic) {
                const staticBinding = binding.copy(null, binding.handler.bind(owner));
                removeStaticBinding = addBinding.call(
                    staticDescriptor, policy, staticBinding, true, true);
            }
        } else if (!skipInference) {
            const inferenceBinding = binding.copy(null, InferenceHandler.prototype.collect);
            inferenceBinding[ownerSymbol] = owner;
            removeInferenceBinding = addBinding.call(
                inferenceDescriptor, policy, inferenceBinding, true, true);
        }
    } else {
         return Undefined;
    }

    return function (notifyRemoved) {
        policyBindings.remove(binding);
        if (policyBindings.isEmpty) {
            bindings.delete(policy);
        }
        if (removeStaticBinding) {
            removeStaticBinding(notifyRemoved);
        } else if (removeInferenceBinding) {
            removeInferenceBinding(notifyRemoved);
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
                        target, callback, { composer, constraint, binding });
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

export const Binding = Base.extend({
    constructor(constraint, handler, removed) {
        if ($classOf(this) === Binding) {
             throw new Error("Binding cannot be instantiated.  Use Binding.create().");
        }
        this.constraint = constraint;
        this.handler    = handler;
        if (removed) {
            this.removed = removed;
        }
    },

    equals(other) {
        return this.constraint === other.constraint
            && (this.handler === other.handler ||
               (this.handler.key && other.handler.key &&
                this.handler.key === other.handler.key));
    },
    copy(constraint, handler) {
        return new ($classOf(this))(
            constraint || this.constraint,
            handler    || this.handler);
    }
}, {
    create(constraint, handler, removed) {
        let bindingType;
        const invariant = $eq.test(constraint);
        constraint = $contents(constraint);
        if ($isNothing(constraint)) {
            bindingType = invariant ? BindingNone : BindingEverything;
        } else if ($isProtocol(constraint)) {
            bindingType = invariant ? BindingInvariant : BindingProtocol;
        } else if ($isClass(constraint)) {
            bindingType = invariant ? BindingInvariant : BindingClass;
        } else if ($isString(constraint)) {
            bindingType = BindingString;
        } else if (constraint instanceof RegExp) {
            bindingType = invariant ? BindingNone : BindingRegExp;
        } else if ($isFunction(constraint)) {
            bindingType = BindingCustom;
        } else {
            bindingType = BindingNone;
        }
        return new bindingType(constraint, handler, removed);
    }
});

const BindingNone = Binding.extend({
    match() { return false; }
});

const BindingInvariant = Binding.extend({
    match(match) {
        return this.constraint === match;
    }
});

const BindingEverything = Binding.extend({
    match(match, variance) {
        return variance !== Variance.Invariant;
    }
});

const BindingProtocol = Binding.extend({
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

const BindingClass = Binding.extend({
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

const BindingString = Binding.extend({
    match(match, variance) {
        if (!$isString(match)) return false;
        return variance === Variance.Invariant
             ? this.constraint == match
             : this.constraint.toLowerCase() == match.toLowerCase();   
    }
});

const BindingRegExp = Binding.extend({
    match(match, variance) {
        return (variance !== Variance.Invariant) && this.constraint.test(match);
    }
});

const BindingCustom = Binding.extend({
    match(match, variance) {
        return this.constraint.call(this, match, variance);
    }
});

function requireValidPolicy(policy) {
    if ($isNothing(policy)) {
        throw new Error("The policy argument is required.")
    }
    if (!(policy instanceof CallbackPolicy)) {
        throw new TypeError("The policy argument is not a valid CallbackPolicy.");
    }
}

function createIndex(constraint) {
    if ($isNothing(constraint)) return;
    if ($isString(constraint)) return constraint;
    if ($isFunction(constraint)) {
        return assignID(constraint);
    }
}

export default HandlerDescriptor;
