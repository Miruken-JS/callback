import { Options } from "../options";
import { handlesOptions } from "../handler-options";

/**
 * Options for controlling filters.
 * @class FilterOptions
 * @extends Options
 */
@handlesOptions("filterOptions")
export class FilterOptions extends Options {
    providers;
    skipFilters;
}

