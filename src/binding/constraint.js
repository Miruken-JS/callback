import { 
    emptyArray, isDescriptor, $isFunction,
    createTypeInfoDecorator

} from "miruken-core";

import { createFilterDecorator } from "../filter/filter";
import { ConstraintProvider } from "./constraint-filter";
import { BindingConstraint } from "./binding-constraint";

export function createConstraintDecorator(createConstraint) {
    if (!$isFunction(createConstraint)) {
        throw new Error("The createConstraint argument must be a function.")
    }
    return function (target, key, descriptorOrIndex) {
        if (arguments.length === 0) { // ConstraintBuilder
            return createConstraint();
        }
        if (isDescriptor(descriptorOrIndex)) /* member */ {
            createConstraintFilter(createConstraint, target, key, descriptorOrIndex, emptyArray);
        } else if (target != null && (key == null || typeof key == "string") &&
                       typeof descriptorOrIndex == "number") /* parameter */ {
            createConstrainedArgument(createConstraint, target, key, descriptorOrIndex, emptyArray);
        } else {
            const args = [...arguments];
            return function (target, key, descriptorOrIndex) {
                if (arguments.length === 0) { // ConstraintBuilder
                    return createConstraint(...args);
                }
                if ((key == null && descriptorOrIndex == null) /* class */ ||
                     isDescriptor(descriptorOrIndex)) /* member */ {
                    createConstraintFilter(createConstraint, target, key, descriptorOrIndex, args);
                } else  if (target != null && (key == null || typeof key == "string") &&
                            typeof descriptorOrIndex == "number") /* parameter */ {
                    createConstrainedArgument(createConstraint, target, key, descriptorOrIndex, args);
                } else {
                    throw new SyntaxError("Constraints can be applied to classes, methods and arguments.");
                }
            }
        }
    };
}

function createConstraintFilter(createConstraint, target, key, descriptor, args) {
    const decorator = createFilterDecorator((target, key, descriptor) => {
        const constraint = createConstraint(...args);
        if (!(constraint instanceof BindingConstraint)) {
            throw new SyntaxError("The createConstraint function did not return a BindingConstraint.");
        }
        return new ConstraintProvider(constraint);
    });
    return descriptor == null /* class */
         ? decorator(args)(target, key, descriptor)
         : decorator(target, key, descriptor);
}

function createConstrainedArgument(createConstraint, target, key, parameterIndex, args) {
    createTypeInfoDecorator((key, typeInfo) => {
        const constraint = createConstraint(...args);
        if (!(constraint instanceof BindingConstraint)) {
            throw new SyntaxError("The createConstraint function did not return a BindingConstraint.");
        }
        typeInfo.addConstraint(constraint);
    })(target, key, parameterIndex);
}

export const constraint = createConstraintDecorator(constraint => constraint);

