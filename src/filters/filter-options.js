import { design } from "miruken-core";
import Options from "../options";
import { FilteringProvider } from "./filtering";

/**
 * Options for controlling filters.
 * @class FilterOptions
 * @extends Options
 */
export class FilterOptions extends Options {
    @design(Boolean)
    skipFilters;
    
    @design([FilteringProvider])
    providers;
    
    mergeKeyInto(options, key, keyValue, optionsValue) {
        if (key === "providers") {
            if (keyValue && this.providers) {
                options.providers = options.providers.concat(keyValue);
            }
        }
        this.base(options, key, keyValue, optionsValue);
     }
}

export default FilterOptions;
