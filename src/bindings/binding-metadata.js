import { 
    $isNothing, createKey
} from "miruken-core";

const _ = createKey();

export class BindingMetadata {
    constructor() {
        _(this).values = new Map();
    }

    name = undefined

    get isEmpty() {
        return $isNothing(this.name) && _(this).values.size === 0;
    }

    has(key) {
        if ($isNothing(key)) {
            throw new Error("The key is required.");
        }
        return _(this).values.has(key);
    }

    get(key) {
         if ($isNothing(key)) {
            throw new Error("The key is required.");
        }
        return _(this).values.get(key);
    }

    set(key, value) {
         if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }
        return _(this).values.set(key, value);
    }

    mergeInto(other) {
        if (!(other instanceof BindingMetadata)) {
            throw new TypeError("The other argument is not a BindingMetadata.")
        }
        for (let [key, value] of _(this).values) {
            other.set(key, value);
        }
    }
}

export default BindingMetadata;