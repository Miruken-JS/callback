import { 
    StrictProtocol, TypeInfo, $isNothing,
    $compose2
} from "miruken-core";

import BindingConstraint from "./bindings/binding-constraint";

export const KeyResolving = StrictProtocol.extend({
    validate(key, typeInfo) {},     
    resolve(inquiry, typeInfo, handler) {}
});

TypeInfo.implement({
    addConstraint(constraint) {
        if ($isNothing(constraint)) {
            throw new Error("The constraint argument is required.");
        }
        if (!(constraint instanceof BindingConstraint)) {
            throw new TypeError("The constraint argument is not a BindingConstraint.");
        }
        const constraints = this.constraints,
              require     = b => b.require(constraint);
        this.constraints = $isNothing(constraints)
            ? require : $compose2(require, constraints);
    },

    merge(otherTypeInfo) {
        this.base(otherTypeInfo);

        const keyResolver      = this.keyResolver,
              constraints      = this.constraints,
              otherConstraints = otherTypeInfo.constraints;

        if ($isNothing(keyResolver)) {
            this.keyResolver = otherTypeInfo.keyResolver;
        }

        if (!$isNothing(otherConstraints)) {
            this.constraints = $isNothing(constraints)
                ? otherConstraints : $compose2(otherConstraints, constraints);
        }
    }
});

export default KeyResolving;
