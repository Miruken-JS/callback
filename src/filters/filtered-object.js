import { 
    Base, emptyArray, $isNothing, createKey
} from "miruken-core";

import { Filtered } from "./filtering";

const _ = createKey();

export const FilteredObject = Base.extend(Filtered, {
    constructor(providers) {
        this.addFilters.apply(this, arguments);
    },

    get filters() {
        const filters = _(this).filters;
        return $isNothing(filters) ? emptyArray : [...filters];
    },

    addFilters(providers) {
        providers = getProviders.apply(this, arguments);
        if ($isNothing(providers) || providers.length === 0) {
            return;
        }
        const filters = _(this).filters;
        if ($isNothing(filters)) {
            _(this).filters = new Set(providers);
        } else {
            providers.forEach(p => filters.add(p));
        }
    },
    removeFilters(providers) {
        providers = getProviders.apply(this, arguments);
        if ($isNothing(providers) || providers.length === 0) {
            return;
        }
        const filters = _(this).filters;
        if ($isNothing(filters)) return;
        providers.forEach(p => filters.delete(p));  
    },
    removeAllFilters() {
        const filters = _(this).filters;
        if (filters) {
            filters.clear();
        }
    }
});

function getProviders(providers) {
    if ($isNothing(providers)) return;
    return Array.isArray(providers)
         ? providers
         : Array.from(arguments);
}

export default FilteredObject;
