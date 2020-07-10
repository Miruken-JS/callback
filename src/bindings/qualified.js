import { $isNothing, createKey } from "miruken-core";
import BindingConstraint from "./binding-constraint";
import { createConstraintDecorator } from "./constraint";

const _ = createKey();

export class QualifierConstraint extends BindingConstraint {
    constructor(qualifierType) {
        super();
        if ($isNothing(qualifierType)) {
            throw new Error("The qualifierType argument is required.")
        }
        _(this).qualifierType = qualifierType;
    }

    require(metadata) {
        if ($isNothing(metadata)) {
            throw new Error("The metadata argument is required.");
        }
        metadata.set(_(this).qualifierType, null);
    }

    matches(metadata) {
        return metadata.isEmpty || metadata.has(_(this).qualifierType);
    }

    static of(qualifierType) {
        return new Qualifier(qualifierType);
    }
}

export const qualified = createConstraintDecorator(
     (target, key, descriptor, [qualifierType]) => new Qualifier(qualifierType));

export default qualified;
