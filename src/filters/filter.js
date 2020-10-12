import {
     Metadata, $isNothing, $isFunction, $isBoolean
} from "miruken-core";

import { FilterSpec } from "./filter-spec";
import { FilterSpecProvider } from "./filter-spec-provider";
import { FilteredScope } from "./filtered-scope";

const filterMetadataKey        = Symbol("filter-metadata"),
      skipFilterMetadataKey    = Symbol("skipFilter-metadata"),
      allowMultipleMetadataKey = Symbol("allowMultiple");

export function createFilterDecorator(createFilterProvider) {
    if (!$isFunction(createFilterProvider)) {
        throw new Error("The createFilterProvider argument must be a function.");
    }
    return Metadata.decorator(filterMetadataKey, (target, key, descriptor, args) => {
        const provider = createFilterProvider(target, key, descriptor, args);
        if ($isNothing(provider)) return;
        if ($isNothing(descriptor)) {
            const filters = filter.getOrCreateOwn(target, "constructor", () => new FilteredScope());
            filter.getOrCreateOwn(target.prototype, "constructor", () => filters);
            filters.addFilters(provider);
        } else {
            const filters = filter.getOrCreateOwn(target, key, () => new FilteredScope());
            filters.addFilters(provider);
        }
    });
}

export function createFilterSpecDecorator(filterSpec) {
    if (filterSpec instanceof FilterSpec) {
        return createFilterDecorator(_ => new FilterSpecProvider(filterSpec));
    }
    if ($isFunction(filterSpec)) {
        return createFilterDecorator((target, key, descriptor, args) => {
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
    (target, key, descriptor, [filterType, options]) => {
        if ($isNothing(filterType)) {
            throw new Error("@filter requires a filterType.")
        }
        const filterSpec = new FilterSpec(filterType, options);
        return new FilterSpecProvider(filterSpec);
    });

export const skipFilters = Metadata.decorator(skipFilterMetadataKey,
    (target, key, descriptor, args) => {
        if (args.length > 0) {
            throw new SyntaxError("@skipFilters expects no arguments.");
        }
        if ($isNothing(descriptor)) {
            skipFilters.getOrCreateOwn(target, "constructor", () => true);
            skipFilters.getOrCreateOwn(target.prototype, "constructor", () => true);
        } else {
            skipFilters.getOrCreateOwn(target, key, () => true);
        }
    });

export const allowMultiple = Metadata.decorator(allowMultipleMetadataKey,
    (target, key, descriptor, [allow]) => {
        if (!$isNothing(descriptor)) {
            throw new SyntaxError("@allowMultiple can only be applied to classes.");
        }
        if ($isNothing(allow)) {
            allow = false;
        } else if (!$isBoolean(allow)) {
            throw new TypeError("@allowMultiple accepts an optional boolean argument.");
        }
        allowMultiple.getOrCreateOwn(target, () => allow);
        allowMultiple.getOrCreateOwn(target, "constructor", () => allow);
        allowMultiple.getOrCreateOwn(target.prototype, "constructor", () => allow);
    });

