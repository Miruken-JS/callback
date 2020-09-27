import { $isNothing } from "miruken-core";
import { Options } from "../options";
import { FilteringProvider } from "./filtering";

/**
 * Options for controlling filters.
 * @class FilterOptions
 * @extends Options
 */
export class FilterOptions extends Options {
    providers;
    skipFilters;

    mergeKeyInto(options, key, keyValue, optionsValue) {
        if (key === "providers") {
            if ($isNothing(keyValue)) return;
            if (!$isNothing(options.providers)) {
                options.providers = options.providers.concat(keyValue);
                return;
            }
        }
        super.mergeKeyInto(options, key, keyValue, optionsValue);
     }
}

