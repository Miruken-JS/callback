import { 
    Undefined, pcopy, $isNothing,
    $classOf, $isPromise
} from "miruken-core";

import HandlerDescriptor from "./handler-descriptor";
import Handler from "./handler";
import Resolving from "./resolving";
import { $unhandled } from "./callback-policy";
import { NotHandledError } from "./errors";

export class InferenceHandler extends Handler {
    constructor(...types) {
        super();
        const owners          = new Set(),
              inferDescriptor = HandlerDescriptor.get(this, true);
        for (let type of types.flat()) {
            addStaticBindings(type, inferDescriptor);
            addInstanceBindings(type, inferDescriptor, owners);
        }
    }
}

function addStaticBindings(type, inferDescriptor) {
    const typeDescriptor = HandlerDescriptor.get(type);
    if (!$isNothing(typeDescriptor)) {
        for (let [policy, bindings] of typeDescriptor.bindings) {
            for (let binding of bindings) {
                const typeBinding = pcopy(binding);
                typeBinding.handler     = binding.handler.bind(type);
                //typeBinding.skipFilters = true;
                inferDescriptor.addBinding(policy, typeBinding);
            }
        }
    }
}

function addInstanceBindings(type, inferDescriptor, owners) {
    const prototype = type.prototype;
    if ($isNothing(prototype) || owners.has(prototype)) return;
    for (let descriptor of HandlerDescriptor.getChain(prototype)) {
        if (!owners.add(descriptor.owner)) break;
        for (let [policy, bindings] of descriptor.bindings) {
            for (let binding of bindings) {
                const instanceBinding = pcopy(binding);
                instanceBinding.handler     = infer;
                instanceBinding.getMetadata = Undefined;
                inferDescriptor.addBinding(policy, instanceBinding);
            }
        }
    }
}

function infer(callback, { binding, rawCallback, composer, results }) {
    if (rawCallback.canInfer === false) {
        return $unhandled;
    }
    const type      = $classOf(binding.owner),
          resolving = new Resolving(type, rawCallback);
    if (!composer.handle(resolving, false, composer)) {
        return $unhandled;
    }
    if (results) {
        const result = resolving.callbackResult;
        if ($isPromise(result)) {
            results(result.then(() => {
                if (!resolving.succeeded) {
                    throw new NotHandledError(callback);
                }
            }));
        }
    }
}

export default InferenceHandler;
