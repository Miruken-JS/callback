import { 
    $isNothing, createKey 
} from "miruken-core";

import { 
    handles, provides, $unhandled 
} from "../callback-policy";

import { Handler } from "../handler";
import { unmanaged } from "../unmanaged";

const _ = createKey();

export class StashAction {
    constructor(key) {
        if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }
        _(this).key = key;
    }

    get canFilter() { return false; }
    get key() { return _(this).key; }

    static Get = class extends StashAction {
        get value() { return _(this).value; }
        set value(value) { _(this).value = value; }
    }

    static Put = class extends StashAction {
        constructor(key, value) {
            super(key);
            _(this).value = value;
        }

        get value() { return _(this).value; }
    }

    static Drop = class extends StashAction {}
}

@unmanaged
export class Stash extends Handler {
    constructor(root = false) {
        super();
        _(this).root = root;
        _(this).data = new Map();
    }

    @provides
    provide(inquiry) {
        const key = inquiry.key,
            { data } = _(this);
        if (data.has(key)) {
            inquiry.resolve(data.get(key), true);
        }          
    }

    @handles(StashAction.Get)
    get(get) {
        const key = get.key,
            { root, data } = _(this);
        if (data.has(key)) {
            get.value = data.get(key);
        } else if (!root) {
            return $unhandled;
        }
    }

    @handles(StashAction.Put)
    put(put) {
        const { key, value } = put;
        if (value === undefined) {
            _(this).data.delete(key); 
        } else {
            _(this).data.set(key, value);
        }
    }

    @handles(StashAction.Drop)
    drop(drop) {
        _(this).data.delete(drop.key);   
    }
}
