import { $isNothing, createKey } from "miruken-core";
import BindingConstraint from "./binding-constraint";
import { createConstraintDecorator } from "./constraint";

const _ = createKey();

export class QualifierConstraint extends BindingConstraint {
    constructor(qualifier) {
        super();
        _(this).qualifier = Symbol();
    }

    require(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        metadata.set(_(this).qualifier, null);
    }

    matches(metadata) {
        return metadata.isEmpty || metadata.has(_(this).qualifier);
    }
}

export function createQualifier() {
    const qualifier = new QualifierConstraint();
    // Pass the qualifer as an argument to help distinguish class
    // decorators without any arguments.
    return createConstraintDecorator((...args) => qualifier)(qualifier);
}

export default createQualifier;
