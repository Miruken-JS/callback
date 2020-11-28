import { 
    conformsTo, $isNothing, $isFunction, 
    createTypeInfoDecorator, createKey 
} from "miruken-core";

import { Stash } from "./stash";
import { KeyResolving } from "../key-resolving";

const _ = createKey();

export class StashOf {
    constructor(key, handler) {
        if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }
        if ($isNothing(handler)) {
            throw new Error("The handler argument is required.");
        }
        _(this).key     = key;
        _(this).handler = handler;
    }

    get value() {
        const { key, handler } = _(this);
        return handler.stashTryGet(key);
    }

    set value(value) {
        const { key, handler } = _(this);
        handler.stashPut(value, key);
    }

    getOrPut(value) {
        const { key, handler } = _(this);
        if ($isFunction(value)) {
            const getter = () => value(handler);
            return handler.stashGetOrPut(key, getter);
        }
        return handler.stashGetOrPut(key, value);
    }

    drop() {
        const { key, handler } = _(this);
        handler.drop(key);
    }
}

@conformsTo(KeyResolving)
export class StashOfResolver {
    constructor(key) {
        if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }
        _(this).key = key;
    }

    resolve(typeInfo, handler) {
        return new StashOf(_(this).key, handler);
    }
}

export const stashOf = createTypeInfoDecorator((key, typeInfo, [stashKey]) => {
    typeInfo.keyResolver = new StashOfResolver(stashKey);
});
