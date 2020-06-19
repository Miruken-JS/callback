import { 
    emptyArray, pcopy, $isSomething
} from "miruken-core";

import Handler from "./handler";
import HandlerDescriptor from "./handler-descriptor";

export class StaticHandler extends Handler {
    constructor(...types) {
        super();
        const descriptor = HandlerDescriptor.get(this, true);
        for (let type of types.flat()) {
            const typeDescriptor = HandlerDescriptor.get(type);
            if ($isSomething(typeDescriptor)) {
                for (let [policy, bindings] of typeDescriptor.bindings) {
                    for (let binding of bindings) {
                        const typeBinding = pcopy(binding);
                        typeBinding.handler     = binding.handler.bind(type);
                        typeBinding.owner       = binding.owner || type;
                        typeBinding.skipFilters = true;
                        descriptor.addBinding(policy, typeBinding);
                    }
                }
            }
        }
    }
}

export default StaticHandler;
