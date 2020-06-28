import { 
    Base, Abstract, Variance, IndexedList,
    Metadata, TypeFlags, design, $isNothing,
    $eq, $isFunction, $isString, $isPromise,
    $classOf, $isObject, $optional, $contents,
    assignID, pcopy, createKey
} from "miruken-core";

import Binding from "./binding";
import Inquiry from "./inquiry";
import KeyResolver from "./key-resolver";
import Filtering from "./filters/filtering";
import FilteredObject from "./filters/filtered-object";
import FilterInstanceProvider from "./filters/filter-instance-provider";
import filter from "./filters/filter";
import { NotHandledError } from "./errors";

const _ = createKey(),
      defaultKeyResolver = new KeyResolver(),
      descriptorMetadataKey = Symbol("descriptor-metadata");

export class HandlerDescriptor extends FilteredObject {
    constructor(owner) {
        if ($isNothing(owner)) {
            throw new Error("The owner argument is required.");
        }
        super();
        _(this).owner    = owner;
        _(this).bindings = new Map();
    }

    get owner()    { return _(this).owner; }
    get policies() { return [..._(this).bindings.keys()]; }
    get bindings() { return [..._(this).bindings.entries()]; }

    getBindings(policy) {
        requireValidPolicy(policy);
        return _(this).bindings.get(policy);
    }

    addBinding(policy, constraint, handler, key, removed) {
        requireValidPolicy(policy);
        const binding = constraint instanceof Binding ? constraint
            : Binding.create(constraint, this.owner, handler, key, removed);
        return addBinding.call(this, policy, binding);
    }

    removeBindings(policy) {
        requireValidPolicy(policy);

        const owner          = this.owner,
              bindings       = _(this).bindings,
              policyBindings = bindings.get(policy);
        if (policyBindings == null) return;

        for (let binding of policyBindings) {
            if (binding.removed) {
                binding.removed(owner);
            }
        }

        bindings.delete(policy);
    }

    dispatch(policy, handler, callback, rawCallback, constraint,
             composer, greedy, results) {
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
                                       rawCallback, constraint, index, variance,
                                       composer, greedy, results)
                      || dispatched;
            if (dispatched && !greedy) return true;
        }
        return dispatched; 
    }

    *getDescriptorChain(includeSelf) {
        if (includeSelf) yield this;
        yield* HandlerDescriptor.getChain(Object.getPrototypeOf(this.owner));
    }

    /**
     * Metadata management methods.
     * The following methods are used to support the metadata
     * system when base2 classes are used.  The instance and
     * static object literals will be decorated first so it
     * is necessary to copy or merge their metadata on to
     * the correct classes or prototypes.
     */

    copyMetadata(target, source, sourceKey) {
        if (sourceKey) return;
        const targetDescriptor = HandlerDescriptor.get(target, true);
         for (let [policy, bindings] of this.bindings) {
            for (let binding of bindings) {
                // Base2 classes can have constructor decorators.
                if (binding.constraint == "#constructor") {
                    const clazz           = $classOf(target),
                          classDescriptor = HandlerDescriptor.get(clazz, true),
                          constructor     = Binding.create(
                              clazz, binding.handler.bind(clazz), "constructor");
                    constructor.owner = target;
                    addBinding.call(classDescriptor, policy, constructor);
                } else {
                    addBinding.call(targetDescriptor, policy, pcopy(binding));
                }
            }
        }
        return targetDescriptor;
    }

    mergeMetadata(sourceDescriptor, target, source, sourceKey) {
        if ($classOf(sourceDescriptor) !== $classOf(this)) {
            throw new TypeError("mergeMetadata expects a HandlerDescriptor.");
        }
        if (sourceKey) return;
        for (let [policy, bindings] of sourceDescriptor.bindings) {
            for (let binding of bindings) {
                addBinding.call(this, policy, pcopy(binding));
            }
        }
    }

    static get(owner, create) {
        if (create) {
            return Metadata.getOrCreateOwn(
                descriptorMetadataKey, owner, () => new this(owner));
        }
        return Metadata.getOwn(descriptorMetadataKey, owner);
    }

    static *getChain(target) {
        while (target && target !== Base.prototype &&
               target !== Object.prototype && target !== Abstract.prototype) {
            const descriptor = HandlerDescriptor.get(target);
            if (descriptor) yield descriptor;
            target = Object.getPrototypeOf(target);
        }
    }

    static remove(owner) {
        return Metadata.remove(descriptorMetadataKey, owner);
    }
}

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

function dispatch(policy, target, callback, rawCallback, constraint,
                  index, variance, composer, all, results) {
    let dispatched = false;
    const bindings = this.getBindings(policy);
    if (bindings == null) return false;;
    const invariant = (variance === Variance.Invariant);
    if (!invariant || index) {
        for (let binding of bindings.fromIndex(index)) {
            if (binding.match(constraint, variance)) {
                let guard;
                const guardDispatch = rawCallback.guardDispatch;
                if ($isFunction(guardDispatch)) {
                    guard = guardDispatch.call(rawCallback, target, binding);
                    if (!guard) continue;
                }
                try {
                    let filters, result, completed = true;;
                    if (rawCallback.canFilter !== false) {
                        filters = resolveFilters.call(
                            this, policy, target, callback, binding, composer);
                        if ($isNothing(filters)) continue;
                    }
                    if ($isNothing(filters) || filters.length == 0) {
                        const signature = binding.getMetadata(design),
                              args = resolveArgs.call(
                                  this, callback, rawCallback, signature, composer);
                        if ($isNothing(args)) continue;
                        const context = { constraint, binding, rawCallback, composer, results },
                              handler = binding.handler;
                        result = $isPromise(args)
                               ? args.then(a => handler.call(target, ...a, context))
                               : handler.call(target, ...args, context);
                    } else {
                        result = filters.reduceRight((next, pipeline) => {
                            return (comp, proceed) => {
                                if (proceed) {
                                    const filter    = pipeline.filter,
                                          signature = design.get(filter, "next"),
                                          args      = resolveArgs.call(
                                              this, callback, rawCallback, signature, comp);
                                    if (!$isNothing(args)) {
                                        const provider = pipeline.provider,
                                              context  = { binding, rawCallback, provider, composer: comp,
                                                           next: (c, p) => next(
                                                               c != null ? c : comp, 
                                                               p != null ? p : true),
                                                           abort: () => next(null, false) };
                                        return $isPromise(args)
                                             ? args.then(a => filter.next(...a, context))
                                             : filter.next(...args, context);
                                    }
                                }
                                completed = false;
                            };
                        }, (comp, proceed) => {
                            if (proceed) {
                                const signature = binding.getMetadata(design),
                                      args = resolveArgs.call(
                                          this, callback, rawCallback, signature, comp);
                                if ($isNothing(args)) {
                                    completed = false;
                                    return Promise.reject(new NotHandledError(callback,
                                        `'${binding.key}' is missing one or more dependencies.`));
                                }
                                const context = { constraint, binding, rawCallback, composer: comp, results },
                                      handler = binding.handler;
                                return $isPromise(args)
                                     ? args.then(a => handler.call(target, ...a, context))
                                     : handler.call(target, ...args, context); 
                            }
                            completed = false;
                        })(composer, true);
                    }
                    if (!completed) continue;
                    if (policy.acceptResult(result)) {
                        if (!results || results(result, composer) !== false) {
                            if (!all) return true;
                            dispatched = true;
                        }
                    }
                } finally {
                    if ($isFunction(guard)) {
                        guard.call(rawCallback);
                    }
                }
            } else if (invariant) {
                break;  // stop matching if invariant not satisifed
            }
        }
    }
    return dispatched;
}

function resolveFilters(policy, target, callback, binding, composer) {
    const targetFilter = Filtering.isAdoptedBy(target)
                       ? new FilterInstanceProvider([target], true)
                       : null;
    return composer.getOrderedFilters(binding, callback, [
        binding.getMetadata(filter), this, policy, targetFilter
    ]);
}

function resolveArgs(callback, rawCallback, signature, composer) {
    if ($isNothing(signature)) {
        return [callback];
    }
    const { args } = signature;
    if ($isNothing(args) || args.length === 0) {
        return [callback];
    }

    const parent   = rawCallback instanceof Inquiry ? rawCallback : null,
          resolved = [],
          promises = [];

    for (let i = 0; i < args.length; ++i) {     
        const arg = args[i];
        if ($isNothing(arg)) {
            if (i === 0) {
                resolved[0] = callback;
            }
            continue;
        }

        if (i === 0) {
            if (arg.validate(callback)) {
                resolved[0] = callback;
                continue;
            }
            if (arg.validate(rawCallback)) {
                resolved[0] = rawCallback;
                continue;
            }
        }

        const many     = arg.flags.hasFlag(TypeFlags.Array),
              inquiry  = new Inquiry(arg.type, many, parent),
              resolver = arg.keyResolver || defaultKeyResolver;

        const validate = resolver.validate;
        if ($isFunction(validate)) {
            validate.call(resolver, inquiry.key, arg);
        }
        
        const dep = resolver.resolve(inquiry, arg, composer);
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
