import { Protocol } from "miruken-core";

export const BindingScope = Protocol.extend({
    /**
     * Gets associated binding metadata.
     * @property {BindingMetadata} metadata
     * @readOnly
     */        
    get metadata() {}
});

