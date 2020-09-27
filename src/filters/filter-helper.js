import { 
    emptyArray, $isFunction, $isNothing
} from "miruken-core";

import { Binding } from "../bindings/binding";
import { Handler } from "../handler";
import { provides } from "../callback-policy";
import { FilterInstanceProvider } from "./filter-instance-provider";
import { FilterOptions } from "./filter-options";
import { skipFilters } from "./filter";
import "../handler-options";

Handler.registerOptions(FilterOptions, "filterOptions");

Handler.implement({
    skipFilters(skip = true) {
        return this.filterOptions({
            skipFilters: skip
        });
    },
    enableFilters(enable = true) {
        return this.filterOptions({
            skipFilters: !enable
        });
    },
    withFilters(filters) {
        return filters ? this.filterOptions({
            providers: [new FilterInstanceProvider(filters.flat())]
        }) : this;
    },
    withFilterProviders(providers) {
        return providers ? this.filterOptions({
            providers: providers.flat()
        }) : this;
    },
    getOrderedFilters(binding, callback, providers) {
        const options        = this.getOptions(FilterOptions),
              extraProviders = options && options.providers;

        let  handler,
             allProviders = providers.flatMap(p => {
                if ($isNothing(p)) return emptyArray;
                if (Array.isArray(p)) return p;
                return p.filters || [p];
             }).filter(p => {
                 const appliesTo = p.appliesTo;
                 return !$isFunction(appliesTo) || appliesTo.call(p, callback) !== false;
             }).concat(extraProviders || emptyArray);

        switch (options && options.skipFilters) {
            case true:
                allProviders = allProviders.filter(p => p.required);
                handler = this;
                break;
            case null:
                if (binding.skipFilters || binding.getMetadata(skipFilters)) {
                    allProviders = allProviders.filter(p => p.required);
                }
                handler = this.skipFilters();
                break;
            case false:
                handler = this.skipFilters();
                break;
        }

        const ordered  = [],
              accepted = [];

        for (let provider of allProviders) {
            const accept = provider.accept;
            if ($isFunction(accept) && !accept.call(provider, accepted)) {
                continue;
            }
            let found = false;
            const filters = provider.getFilters(binding, callback, handler);
            if (filters == null) return;
            for (let filter of filters) {
                if (filter == null) return;
                found = true;
                ordered.push({ filter, provider });
            }
            if (!found) return;
            accepted.push(provider);
        }

        return ordered.sort((a, b) => {
            if (a.filter === b.filter) return 0;
            if (a.filter.order === b.filter.order || 
                b.filter.order == null) return -1;
            if (a.filter.order == null) return 1;
            return a.filter.order - b.filter.order;
        });
    }
});