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

    get required() { return _(this).filterSpec.required; }

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

