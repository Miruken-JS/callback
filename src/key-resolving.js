import { 
    StrictProtocol, TypeInfo, $isNothing
} from "miruken-core";

export const KeyResolving = StrictProtocol.extend({
    validate(key, typeInfo) {},     
    resolve(inquiry, typeInfo, handler) {}
});

TypeInfo.implement({
    merge(otherTypeInfo) {
        this.base(otherTypeInfo);
        if ($isNothing(this.keyResolver)) {
            this.keyResolver = otherTypeInfo.keyResolver;
        }
    }
});

export default KeyResolving;
