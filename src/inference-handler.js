import { 
    Undefined, $isNothing, $isPromise
} from "miruken-core";

import HandlerDescriptor from "./handler-descriptor";
import Handler from "./handler";
import Resolving from "./resolving";
import { $unhandled } from "./callback-policy";
import { NotHandledError } from "./errors";

export const InferenceHandler = Handler.extend({
    constructor(types) {
        if ($isNothing(types)) {
            throw new Error("The types argument is required");
        }
        const owners          = new Set(),
              inferDescriptor = HandlerDescriptor.get(this, true);
        for (let type of types) {
            const prototype = type.prototype;
            if ($isNothing(prototype)) continue;
            for (let descriptor of HandlerDescriptor.getChain(prototype)) {
                if (!owners.add(descriptor.owner)) continue;
                for (let [policy, bindings] of descriptor.bindings) {
                    for (let binding of bindings) {
                        const instanceBinding = binding.copy(null, function (...args) {
                            return this.infer(type, ...args);
                        });
                        inferDescriptor.addBinding(policy, instanceBinding);
                    }
                }
            }
        }
    },

    infer(type, callback, { composer, results }) {
        const resolving = new Resolving(type, callback);
        if (!composer.handle(resolving, false, composer)) {
            return $unhandled;
        } else if (results) {
            const result = resolving.callbackResult;
            if (!$isPromise(result)) return;
            results(result.then(() => {
                if (!resolving.succeeded) {
                    throw new NotHandledError(callback);
                }
            }));
        }
    }
});

export default InferenceHandler;
