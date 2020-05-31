import { 
    Base, Abstract, Variance, IndexedList,
    Metadata, TypeFlags, design, $isNothing,
    $eq, $isFunction, $isString, $isPromise,
    $classOf, $isObject, $optional, $contents,
    assignID, createKey
} from "miruken-core";

import Binding from "./binding";
import Inquiry from "./inquiry";
import KeyResolver from "./key-resolver";

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
        const binding = constraint instanceof Binding ? constraint
                      : Binding.create(constraint, handler, removed);
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

        let variance = policy.variance;
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

        if (results) {
            results = results.bind(callback);
        }

        const index = createIndex(constraint);

        let dispatched = false;
        for (let descriptor of this.getDescriptorChain(true)) {
            dispatched = dispatch.call(descriptor, policy, handler, callback,
                                       constraint, index, variance, composer,
                                       greedy, results)
                      || dispatched;
            if (dispatched && !greedy) return true;
        }
        return dispatched; 
    },
    *getDescriptorChain(includeSelf) {
        if (includeSelf) yield this;
        yield* HandlerDescriptor.getChain(Object.getPrototypeOf(this.owner));
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
                    const clazz           = $classOf(target),
                          classDescriptor = HandlerDescriptor.get(clazz, true),
                          constructor     = Binding.create(clazz, binding.handler.bind(clazz));
                    addBinding.call(classDescriptor, policy, constructor);
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
        return Metadata.getOwn(descriptorMetadataKey, owner);
    },
    *getChain(target) {
        while (target && target !== Base.prototype &&
               target !== Object.prototype && target !== Abstract.prototype) {
            const descriptor = HandlerDescriptor.get(target);
            if (descriptor) yield descriptor;
            target = Object.getPrototypeOf(target);
        }
    },
    remove(owner) {
        return Metadata.remove(descriptorMetadataKey, owner);
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
                  variance, composer, all, results) {
    let dispatched  = false;
    const bindings = this.getBindings(policy);
    if (bindings == null) return false;;
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
                    const handler = binding.handler,
                          args    = resolveArgs.call(this, callback, target, handler, composer);
                    if ($isNothing(args)) continue;
                    const context = { composer, constraint, binding, results },
                          result  = $isPromise(args)
                                  ? args.then(a => handler.call(target, ...a, context))
                                  : handler.call(target, ...args, context);
                    if (policy.acceptResult(result)) {
                        if (!results || results(result, composer) !== false) {
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

function resolveArgs(callback, target, handler, composer) {
    const resolved = [callback]
    if ($isNothing(handler.key)) return resolved;
    const signature = design.getOwn(this.owner, handler.key);
    if ($isNothing(signature)) return resolved;
    const { args } = signature;
    if ($isNothing(args) || args.length <= 1) return resolved;

    const parent   = callback instanceof Inquiry ? callback : null,
          promises = [];

    for (let i = 1; i < args.length; ++i) {     
        const arg = args[i];
        if ($isNothing(arg)) continue;
        
        const many     = arg.flags.hasFlag(TypeFlags.Array),
              inquiry  = new Inquiry(arg.type, many, parent),
              resolver = KeyResolver;

        if ("validateKey" in resolver) {
            resolver.validateKey(inquiry.key, arg);
        }
        
        const dep = resolver.resolveKey(inquiry, arg, composer);
        if ($isNothing(dep)) return null;
        if ($optional.test(dep)) {
            resolved[i] = $contents(dep);
        } else if ($isPromise(dep)) {
            promises.push(dep.then(result => resolved[i] = result));
        } else {
            resolved[i] = dep;
        }
    }

    if (promises.length === 0) {
        return resolved;
    }
    if (promises.length === 1) {
        return promises[0].then(() => resolved);
    }
    return Promise.all(promises).then(() => resolved);
}

function requireValidPolicy(policy) {
    if ($isNothing(policy)) {
        throw new Error("The policy argument is required.")
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
