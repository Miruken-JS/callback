import { Options } from "../options";
import { handlesOptions } from "../handler-options";

@handlesOptions("mapOptions")
export class MapOptions extends Options {
    /**
     * The type of object.
     * @property {Function} type
     */   
    type;

    /**
     * The fields to map.  Object literal or true.
     * @property {Any} fields
     */   
    fields;

    /**
     * Determines how type identifiers are used.
     * @property {Function} typeIdHandling
     */   
    typeIdHandling;

    /**
     * The mapping strategy.
     * @property {Mapping} strategy
     */   
    strategy;
}
