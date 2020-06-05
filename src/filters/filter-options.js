import { design } from "miruken-core";
import Options from "../options";
import { FilteringProvider } from "./filtering";

/**
 * Options for controlling filters.
 * @class FilterOptions
 * @extends Options
 */
export const FilterOptions = Options.extend({
    @design(Boolean)
    skipFilters: undefined,
    
    @design([FilteringProvider])
    providers: undefined,
    
    mergeKeyInto(options, key, keyValue, optionsValue) {
        if (key === "providers") {
            if (keyValue && this.providers) {
                options.providers = options.providers.concat(keyValue);
            }
        }
        this.base(options, key, keyValue, optionsValue);
     }
});

export default FilterOptions;
