import { StrictProtocol } from "miruken-core";

export const KeyResolving = StrictProtocol.extend({
    validateKey(key, typeInfo) {},     
    resolveKey(inquiry, typeInfo, handler) {}
});

export default KeyResolving;
