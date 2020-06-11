import { 
    TypeInfo, TypeFlags, createTypeInfoDecorator,
    $createQualifier
} from "miruken-core";

import { KeyResolver } from "./key-resolver";

export const $proxy = $createQualifier();

export class ProxyResolver extends KeyResolver {
    validate(key, typeInfo) {
        validateTypeInfo(typeInfo);
    }

    resolveKey(inquiry, typeInfo, handler) {
        return handler.proxy(typeInfo.type);
    }
}

const proxyResolver = new ProxyResolver();

TypeInfo.registerQualifier($proxy, ti => ti.keyResolver = proxyResolver);

export const proxy = createTypeInfoDecorator((typeInfo, [type]) => {
    if (type) {
        const protocol = TypeInfo.parse(type);
        validateTypeInfo(protocol);
        typeInfo.merge(protocol);
    }
    typeInfo.keyResolver = proxyResolver;
}); 

function validateTypeInfo(typeInfo) {
    if (!typeInfo.flags.hasFlag(TypeFlags.Protocol)) {
        throw new TypeError("@proxy requires a protocol argument.");
    }
    if (typeInfo.flags.hasFlag(TypeFlags.Array)) {
        throw new TypeError("@proxy arguments cannot be collections.");
    }
}

export default ProxyResolver;