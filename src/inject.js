import { 
    TypeFlags, createTypeInfoDecorator,
    $isNothing, createKey
} from "miruken-core";

import { Inquiry } from "./inquiry";
import { KeyResolver } from "./key-resolver";

const _ = createKey();

export class InjectResolver extends KeyResolver {
    constructor(key) {
        if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }
        super();
        _(this).key = key;
    }

    get key() { return _(this).key; }

    createInquiry(typeInfo, parent) {
       const many = typeInfo.flags.hasFlag(TypeFlags.Array);
       return new Inquiry(this.key, many, parent);
    }
}

export const inject = createTypeInfoDecorator((key, typeInfo, [actualKey]) => {
    typeInfo.keyResolver = new InjectResolver(actualKey || key);
});

