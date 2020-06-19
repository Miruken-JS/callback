import {
     Metadata, isDescriptor, $isNothing, $isFunction
} from "miruken-core";

import FilterSpec from "./filter-spec";
import FilterSpecProvider from "./filter-spec-provider";
import FilteredObject from "./filtered-object";

const filterMetadataKey     = Symbol("filter-metadata"),
      skipFilterMetadataKey = Symbol("skipFilter-metadata");

export function createFilterDecorator(createFilterProvider) {
    if (!$isFunction(createFilterProvider)) {
        throw new Error("The createFilterProvider argument must be a function.");
    }
    return Metadata.decorator(filterMetadataKey, (target, key, descriptor, args) => {
        const provider = createFilterProvider(args)
        if ($isNothing(isDescriptor(descriptor))) {     
            const filters  = filter.getOrCreateOwn(target, "constructor", () => new FilteredObject()),
                  filtersp = filter.getOrCreateOwn(target.prototype, "constructor", () => filters);
            filters.addFilters(provider);
            return;
        }
        const filters = filter.getOrCreateOwn(target, key, () => new FilteredObject());
        filters.addFilters(provider);
    });
}

export function createFilteSpecDecorator(filterSpec) {
    if (filterSpec instanceof FilterSpec) {
        return createFilterDecorator(_ => new FilterSpecProvider(filterSpec));
    }
    if ($isFunction(filterSpec)) {
        return createFilterDecorator(args => {
            const spec = filterSpec(args);
            if (!(spec instanceof FilterSpec)) {
                throw new TypeError("The filterSpec function did not return a FilterSpec.");
            }
            return new FilterSpecProvider(spec);
        });
    }
    throw new TypeError("The filterSpec argument must be a FilterSpec or a function that return one.");
}

export const filter = createFilterDecorator(
    ([filterType, { required, order } = {}]) => {
        if ($isNothing(filterType)) {
            throw new Error("@filter requires a filterType.")
        }
        const filterSpec = new FilterSpec(filterType, required, order);
        return new FilterSpecProvider(filterSpec);
    });

export const skipFilters = Metadata.decorator(skipFilterMetadataKey,
    (target, key, descriptor, args) => {
        if (args.length > 0) {
            throw new SyntaxError("@skipFilters expects no arguments.");
        }
        if (!isDescriptor(descriptor)) {     
            skipFilters.getOrCreateOwn(target, "constructor", () => true),
            skipFilters.getOrCreateOwn(target.prototype, "constructor", () => true);
            return;
        }
        skipFilters.getOrCreateOwn(target, key, () => true);
    });

export default filter;

