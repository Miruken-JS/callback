import { $isNothing } from "miruken-core";
import { Handler } from "../handler";
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

    mergeKeyInto(options, key, keyValue, optionsValue) {
        switch (key) {
            case "type":
            case "fields":
                // Do not merge these options
                break;
            default:
                return super.mergeKeyInto(options, key, keyValue, optionsValue)
        }
    }
}

Handler.implement({
    $mapType(type) {
        if ($isNothing(type)) {
            throw new Error("The type argument is required.")
        }
        return this.$mapOptions({ type });
    },
    $mapFields(fields) {
        if ($isNothing(fields)) {
            throw new Error("The fields argument is required.")
        }
        return this.$mapOptions({ fields });
    },
    $mapTypeIdHandling(typeIdHandling) {
        if ($isNothing(typeIdHandling)) {
            throw new Error("The typeIdHandling argument is required.")
        }
        return this.$mapOptions({ typeIdHandling });
    },
    $mapStrategy(strategy) {
        if ($isNothing(strategy)) {
            throw new Error("The strategy argument is required.")
        }
        return this.$mapOptions({ strategy });
    }
});