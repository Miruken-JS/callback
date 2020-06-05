import { 
    $isNothing, $isSomething
} from "miruken-core";

import Handler from "./handler";
import HandlerDescriptor from "./handler-descriptor";

export const StaticHandler = Handler.extend({
    constructor(types) {
        if ($isNothing(types)) {
            throw new Error("The types argument is required");
        }
        const descriptor = HandlerDescriptor.get(this, true);
        for (let type of types) {
            const typeDescriptor = HandlerDescriptor.get(type);
            if ($isSomething(typeDescriptor)) {
                for (let [policy, bindings] of typeDescriptor.bindings) {
                    for (let binding of bindings) {
                        const typeBinding = binding.copy(null, binding.handler.bind(type));
                        typeBinding.owner = binding.owner || type;
                        descriptor.addBinding(policy, typeBinding);
                    }
                }
            }
        }
    }
});

export default StaticHandler;
