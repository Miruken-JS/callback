import { 
    Base, TypeInfo, $isProtocol,
    $createQualifier
} from "miruken-core";

import { KeyResolving } from "./key-resolving";

export const $proxy = $createQualifier();

export const ProxyResolver = Base.extend(KeyResolving, {
    validateKey(key, typeInfo) {
        if (!$isProtocol(typeInfo.type)) {
            throw new TypeError("Proxied parameters must be protocols.");
        }
    },
    resolveKey(inquiry, typeInfo, handler) {
        return typeInfo.type(handler);
    }
});

const proxyResolver = new ProxyResolver();

TypeInfo.addParser((spec, typeInfo) => {
    if ($proxy.test(spec)) {
        typeInfo.keyResolver = proxyResolver;
    }
});

export default $proxy;