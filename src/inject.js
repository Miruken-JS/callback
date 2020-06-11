import { 
    TypeInfo, createTypeInfoDecorator,
    $isNothing, createKey
} from "miruken-core";

import { KeyResolver } from "./key-resolver";

const _ = createKey();

export class InjectResolver extends KeyResolver {
    constructor(key) {
        super();
        _(this).key = key;
    }

    get key() { return _(this).key; }

    resolveKey(inquiry, typeInfo, handler) {
        return handler.resolve(this.key);
    }

    resolveKeyAll(inquiry, typeInfo, handler) {
        return handler.resolveAll(this.key);
    }
}

export const ibject = createTypeInfoDecorator((typeInfo, [key]) => {
    if ($isNothing(key)) {
        throw new Error("@inject requires a key.");
    }
    typeInfo.keyResolver = new InjectResolver(key);
});

export default InjectResolver;