import { 
    TypeInfo, TypeFlags, conformsTo,
    createTypeInfoDecorator, $createQualifier
} from "miruken-core";

import { KeyResolving } from "./key-resolving";

export const $proxy = $createQualifier();

@conformsTo(KeyResolving)
export class ProxyResolver {
    validate(typeInfo) {
        if (!typeInfo.flags.hasFlag(TypeFlags.Protocol)) {
            throw new TypeError("@proxy requires a Protocol argument.");
        }
        if (typeInfo.flags.hasFlag(TypeFlags.Array)) {
            throw new TypeError("@proxy arguments cannot be collections.");
        }
    }  

    resolve(typeInfo, handler) {
        return handler.proxy(typeInfo.type);
    }
}

const proxyResolver = new ProxyResolver();

TypeInfo.registerQualifier($proxy, ti => ti.keyResolver = proxyResolver);

export const proxy = createTypeInfoDecorator((key, typeInfo, [type]) => {
    const protocol = TypeInfo.parse(type);
    protocol.keyResolver = proxyResolver;
    typeInfo.merge(protocol);
});

