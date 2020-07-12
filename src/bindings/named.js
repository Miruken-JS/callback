import { $isNothing, createKey } from "miruken-core";
import BindingConstraint from "./binding-constraint";
import { createConstraintDecorator } from "./constraint";

const _ = createKey();

export class NamedConstraint extends BindingConstraint {
    constructor(name) {
        super();
        if (!name) {
            throw new Error("The name cannot be empty.");
        }
        _(this).name = name;
    }

    get name() { return _(this).name; }

    require(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        metadata.name = _(this).name;
    }

    matches(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        const name = metadata.name;
        return $isNothing(name) || this.name == name;
    }
}

export const named = createConstraintDecorator(name => new NamedConstraint(name));

export default named;