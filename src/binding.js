import { 
    Base, Variance, $isNothing, $eq,
    $contents, $isFunction, $isString,
    $isProtocol, $isClass, $classOf
} from "miruken-core";

export const Binding = Base.extend({
    constructor(constraint, handler, removed) {
        if ($classOf(this) === Binding) {
             throw new Error("Binding cannot be instantiated.  Use Binding.create().");
        }
        this.constraint = constraint;
        this.handler    = handler;
        if (removed) {
            this.removed = removed;
        }
    },

    equals(other) {
        return this.constraint === other.constraint
            && (this.handler === other.handler ||
               (this.handler.key && other.handler.key &&
                this.handler.key === other.handler.key));
    },
    copy(constraint, handler) {
        return new ($classOf(this))(
            constraint || this.constraint,
            handler    || this.handler);
    }
}, {
    create(constraint, handler, removed) {
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
        return new bindingType(constraint, handler, removed);
    }
});

const BindingNone = Binding.extend({
    match() { return false; }
});

const BindingInvariant = Binding.extend({
    match(match) {
        return this.constraint === match;
    }
});

const BindingEverything = Binding.extend({
    match(match, variance) {
        return variance !== Variance.Invariant;
    }
});

const BindingProtocol = Binding.extend({
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
});

const BindingClass = Binding.extend({
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
})

const BindingString = Binding.extend({
    match(match, variance) {
        if (!$isString(match)) return false;
        return variance === Variance.Invariant
             ? this.constraint == match
             : this.constraint.toLowerCase() == match.toLowerCase();   
    }
});

const BindingRegExp = Binding.extend({
    match(match, variance) {
        return (variance !== Variance.Invariant) && this.constraint.test(match);
    }
});

const BindingCustom = Binding.extend({
    match(match, variance) {
        return this.constraint.call(this, match, variance);
    }
});

export default Binding;