import { 
    Base, TypeInfo, TypeFlags,
    conformsTo, $createQualifier
} from "miruken-core";

import { KeyResolving } from "./key-resolving";

export const $proxy = $createQualifier();

@conformsTo(KeyResolving)
export class ProxyResolver extends Base {
    validateKey(key, typeInfo) {
        if (!typeInfo.flags.hasFlag(TypeFlags.Protocol)) {
            throw new TypeError("Proxied parameters must be protocols.");
        }
    }

    resolveKey(inquiry, typeInfo, handler) {
        return typeInfo.type(handler);
    }
}

const proxyResolver = new ProxyResolver();

TypeInfo.registerQualifier($proxy, typeInfo => {
    typeInfo.keyResolver = proxyResolver;
});

export default $proxy;