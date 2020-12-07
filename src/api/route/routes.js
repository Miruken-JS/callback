import { 
    conformsTo, $isNothing, $flatten,
    createKey
} from "miruken-core";

import { 
    Filtering, FilteringProvider
} from "../../filter/filtering";

import { Stage } from "../../stage";
import { BatchRouted } from "../route/routed";
import { BatchRouter } from "../route/batch-router";
import { createFilterDecorator } from "../../filter/filter";

const _ = createKey();

@conformsTo(Filtering)
class RoutesFilter {
    constructor(schemes) {
        _(this).schemes = schemes;
    }

    get order() { return Stage.Logging - 1; }

    next(routed, { composer, rawCallback, next }) {
        const matches = _(this).schemes.includes(getScheme(routed));
        if (matches) {
            const batcher = composer.$getBatcher(BatchRouter);
            if (!$isNothing(batcher)) {
                return composer.$enableFilters().command(
                    new BatchRouted(routed, rawCallback));
            }
        }
        return next(composer.$enableFilters(), matches);
    }
}


@conformsTo(FilteringProvider)
export class RoutesProvider {
    constructor(schemes) {
        if ($isNothing(schemes) || schemes.length === 0) {
            throw new Error("The schemes argument cannot be empty.");
        }
        _(this).filters = [new RoutesFilter(schemes)];
    }

    get required() { return true; }

    getFilters(binding, callback, composer) {
        return _(this).filters;
    }
}

export const routes = createFilterDecorator(
    (target, key, descriptor, schemes) =>
        new RoutesProvider($flatten(schemes, true)), true);

function getScheme(routed) {
    const { route } = routed;
    try {
        const uri = new URL(route);
        return uri.slice(0, -1);
    } catch {
        return route;
    }
}