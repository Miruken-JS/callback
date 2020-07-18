import { 
    $isNothing, $isString, createKey
} from "miruken-core";

import { BindingConstraint } from "./binding-constraint";
import { createConstraintDecorator } from "./constraint";

const _ = createKey();

export class MetadataKeyConstraint extends BindingConstraint {
    constructor(key, value) {
        super();
        if ($isNothing(key)) {
            throw new Error("The key argument is required.");
        }
        _(this).key   = value;
        _(this).value = value;
    }

    require(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        const { key, value } = _(this);
        metadata.set(key, value);
    }

    matches(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        const { key, value } = _(this); 
        return metadata.has(key) && metadata.get(key) === value;
    }
}

export class MetadataConstraint extends BindingConstraint {
    constructor(metadata) {
        super();
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        _(this).metadata = metadata;
    }

    require(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        for (let [key, value] of _(this).metadata) {
            metadata.set(key, value)
        }
    }

    matches(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        for (let [key, value] of _(this).metadata) {
            if (!(metadata.has(key) && metadata.get(key) === value)) {
                return false;
            }
        }
        return true;
    }
}

export const metadata = createConstraintDecorator((...args) => {
    if (args.length === 2 && $isString(args[0])) {
        return new MetadataKeyConstraint(args[0], args[1])
    }
    return new MetadataConstraint(...args);
});

