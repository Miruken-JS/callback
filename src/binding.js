import { 
    Variance, $isNothing, $eq,
    $contents, $isFunction, $isString,
    $isProtocol, $isClass, $classOf
} from "miruken-core";

import FilteredObject from "./filters/filtered-object";

export class Binding extends FilteredObject {
    constructor(constraint, handler, key, removed) {
        super();
        if (new.target === Binding) {
             throw new Error("Binding cannot be instantiated.  Use Binding.create().");
        }
        this.constraint = constraint;
        this.handler    = handler;
        this.key        = key;
        if (removed) {
            this.removed = removed;
        }
    }

    equals(other) {
        return this.constraint === other.constraint
            && (this.handler === other.handler ||
               (this.key && other.key && this.key === other.key));
    }

    copy(constraint, handler) {
        const binding = new ($classOf(this))(
            constraint || this.constraint,
            handler    || this.handler);
        binding.key = this.key;
        binding.addFilters(this.filters);
        return binding;
    }

    static create(constraint, handler, key, removed) {
        let bindingType;
        const invariant = $eq.test(constraint);
        constraint = $contents(constraint);
        if ($isNothing(constraint)) {
            bindingType = invariant ? BindingNone : BindingEverything;
        } else if ($isProtocol(constraint)) {
            bindingType = invariant ? BindingInvariant : BindingProtocol;
        } else if ($isClass(constraint)) {
            bindingType = invariant ? BindingInvariant : BindingClass;
        } else if ($isString(constraint)) {
            bindingType = BindingString;
        } else if (constraint instanceof RegExp) {
            bindingType = invariant ? BindingNone : BindingRegExp;
        } else if ($isFunction(constraint)) {
            bindingType = BindingCustom;
        } else {
            bindingType = BindingNone;
        }
        return new bindingType(constraint, handler, key, removed);
    }
}

class BindingNone extends Binding {
    match() { return false; }
}

class BindingInvariant extends Binding {
    match(match) {
        return this.constraint === match;
    }
}

class BindingEverything extends Binding {
    match(match, variance) {
        return variance !== Variance.Invariant;
    }
}

class BindingProtocol extends Binding {
    match(match, variance) {
        const constraint = this.constraint;
        if (constraint === match) {
            return true;
        } else if (variance === Variance.Covariant) {
            return $isProtocol(match) && match.isAdoptedBy(constraint);
        } else if (variance === Variance.Contravariant) {
            return !$isString(match) && constraint.isAdoptedBy(match);
        }
        return false;
    }
}

class BindingClass extends Binding {
    match(match, variance) {
        const constraint = this.constraint;
        if (constraint === match) return true;
        if (variance === Variance.Contravariant) {
            return match.prototype instanceof constraint;
        }
        if (variance === Variance.Covariant) {
            return match.prototype &&
                (constraint.prototype instanceof match
                || ($isProtocol(match) && match.isAdoptedBy(constraint)));
        }
        return false;
    }
}

class BindingString extends Binding {
    match(match, variance) {
        if (!$isString(match)) return false;
        return variance === Variance.Invariant
             ? this.constraint == match
             : this.constraint.toLowerCase() == match.toLowerCase();   
    }
}

class BindingRegExp extends Binding {
    match(match, variance) {
        return (variance !== Variance.Invariant) && this.constraint.test(match);
    }
}

class BindingCustom extends Binding {
    match(match, variance) {
        return this.constraint.call(this, match, variance);
    }
}

export default Binding;