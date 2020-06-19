import { 
    TypeInfo, TypeFlags, createTypeInfoDecorator,
    $createQualifier
} from "miruken-core";

import { KeyResolver } from "./key-resolver";

export const $proxy = $createQualifier();

export class ProxyResolver extends KeyResolver {
    resolveKey(inquiry, typeInfo, handler) {
        return handler.proxy(typeInfo.type);
    }
}

const proxyResolver = new ProxyResolver();

TypeInfo.registerQualifier($proxy, ti => ti.keyResolver = proxyResolver);

export const proxy = createTypeInfoDecorator((key, typeInfo, [type]) => {
    const protocol = TypeInfo.parse(type);
    protocol.keyResolver = proxyResolver;
    typeInfo.merge(protocol);
    if (!typeInfo.flags.hasFlag(TypeFlags.Protocol)) {
        throw new TypeError("@proxy requires a Protocol argument.");
    }
    if (typeInfo.flags.hasFlag(TypeFlags.Array)) {
        throw new TypeError("@proxy arguments cannot be collections.");
    }
}); 

export default ProxyResolver;