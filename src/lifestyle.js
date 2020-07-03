import { 
    emptyArray, conformsTo, $isNothing,
    $isFunction, createKey
} from "miruken-core";

import Inquiry from "./inquiry";

import { 
    Filtering, FilteringProvider
} from "./filters/filtering";

const _ = createKey();

@conformsTo(Filtering)
export class Lifestyle {
    constructor() {
        if (new.target === Lifestyle) {
            throw new TypeError("Lifestyle cannot be instantiated.");
        }
    }

    get order() { return Number.MAX_SAFE_INTEGER - 1000; }

    next(callback, context) {
        if (!(callback instanceof Inquiry)) {
            return context.abort();
        }
        const parent       = callback.parent,
              isCompatible = this.isCompatibleWithParent;
        if ($isNothing(parent) || !$isFunction(isCompatible) ||
            isCompatible.call(this, parent, context)) {
            const getInstance = this.getInstance;
            if ($isFunction(getInstance)) {
                try {
                    const instance = getInstance.call(this, callback, context);
                    if (!$isNothing(instance)) return instance;
                } catch (ex) {
                    // fall through
                }
            } else {
                return context.next();
            }
        }
        return context.abort();
    }
}

@conformsTo(FilteringProvider)
export class LifestyleProvider {
    constructor(lifestyle) {
        if ($isNothing(lifestyle)) {
            throw new Error("The lifestyle argument is required.")
        }
        _(this).lifestyle = [lifestyle];
    }

    get required() { return true; }

    appliesTo(callback) {
        return callback instanceof Inquiry;
    }

    getFilters(binding, callback, composer) {
        return _(this).lifestyle;
    }
}
