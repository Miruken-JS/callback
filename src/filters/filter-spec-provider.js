import { 
    emptyArray, $isNothing, conformsTo,
    createKey
} from "miruken-core";

import { FilteringProvider } from "./filtering";

const _ = createKey();

@conformsTo(FilteringProvider)
export class FilterSpecProvider {
    constructor(filterSpec) {
        if ($isNothing(filterSpec)) {
            throw new Error("The filterSpec is required.")
        }
        _(this).filterSpec = filterSpec;
    }

    get filterSpec() { return _(this).filterSpec; }
    get filterType() { return this.filterSpec.filterType; }
    get required() { return this.filterSpec.required; }
    get multiple() { return this.filterSpec.multiple; }

    accept(providers)
    {
        if ($isNothing(providers) || this.multiple == true) {
            return true;
        }
        const filterType = this.filterType;
        return !providers.some(
            p => p instanceof FilterSpecProvider &&
            p.filterType === filterType);
    }

    getFilters(binding, callback, composer) {
        const spec   = _(this).filterSpec,
              filter = composer.resolve(spec.filterType);
        if ($isNothing(filter)) return emptyArray;
        if (!$isNothing(spec.order)) {
            filter.order = order;
        }
        return [filter];
    }
}

