import { 
    emptyArray, isDescriptor, $isFunction,
    createTypeInfoDecorator

} from "miruken-core";

import { createFilterDecorator } from "../filters/filter";
import BindingConstraint from "./binding-constraint";

export function createConstraintDecorator(createConstraint) {
    if (!$isFunction(createConstraint)) {
        throw new Error("The createConstraint argument must be a function.")
    }
    return function (target, key, descriptorOrIndex) {
        if (isDescriptor(descriptorOrIndex)) {
            createConstraintFilter(target, key, descriptorOrIndex, emptyArray);
        } else if (typeof key == "string" && typeof descriptorOrIndex == "number") {
            createConstrainedArgument(target, key, descriptorOrIndex, emptyArray);
        } else {
            const args = [...arguments];
            return function (target, key, descriptorOrIndex) {
                if (isDescriptor(descriptorOrIndex)) {
                    createConstraintFilter(target, key, descriptorOrIndex, args);
                } else if (typeof key == "string" && typeof descriptorOrIndex == "number") {
                    createConstrainedArgument(target, key, descriptorOrIndex, args);
                } else {
                    throw new SyntaxError("Constraints can be applied to classes, methods and arguments.");
                }
            }
        }
    };
}

function createConstraintFilter(target, key, descriptor, args) {
    createFilterDecorator((target, key, descriptor) => {
        const constraint = createConstraint(...args);
        if (!(constraint instanceof BindingConstraint)) {
            throw new SyntaxError("The createConstraint function did not return a BindingConstraint.");
        }
        return new ConstraintProvider(constraint);
    })(target, key, descriptor);
}

function createConstrainedArgument(target, key, parameterIndex, args) {
    createTypeInfoDecorator((key, typeInfo) => {
        const constraint = createConstraint(...args);
        if (!(constraint instanceof BindingConstraint)) {
            throw new SyntaxError("The createConstraint function did not return a BindingConstraint.");
        }
        typeInfo.addConstraint(constraint);
    })(target, key, parameterIndex);
}

export const constraint = createConstraintDecorator(
     (target, key, descriptor, [constraint]) => constraint);

export default constraint;
