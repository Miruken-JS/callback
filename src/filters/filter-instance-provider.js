import { 
    Base, $isNothing, createKeyChain
} from "miruken-core";

import { FilteringProvider } from "./filtering";

const _ = createKeyChain();

export const FilterInstanceProvider = Base.extend(FilteringProvider, {
    constructor(filters, required) {
        if ($isNothing(filters) || filters.length === 0) {
            throw new Error("At least one filter must be provided.");
        }
        _(this).required = !!required; 
        _(this).filters  = new Set(filters);
    },

    get required() { return _(this).required; },

    getFilters(binding, callback, composer) {
        return _(this).filters;
    }
});

export default FilterInstanceProvider;
