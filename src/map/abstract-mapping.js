import { 
    typeOf, $isFunction, $isNothing,
    $isObject, $classOf
} from "miruken-core";

import { Handler } from "../handler";
import { $unhandled } from "../callback-policy";
import { mapsFrom, mapsTo } from "./maps";
import { MapOptions } from "./map-options";
import { unmanaged } from "../unmanaged";
import { surrogate } from "./surrogate";
import { options } from "../options";

/**
 * Abstract mapping.
 * @class Abstract mapping
 * @extends Handler
 */ 
@unmanaged
export class AbstractMapping extends Handler {
    @mapsFrom
    mapsFrom(mapsFrom, @options(MapOptions) options) {
        return $unhandled;
    }

    @mapsTo
    mapsTo(mapsTo, @options(MapOptions) options) {}

    canSetProperty(descriptor) {
        return !$isFunction(descriptor.value);        
    }

    isPrimitiveValue(value) {
        switch (typeOf(value)) {
            case "null":
            case "number":
            case "string":
            case "boolean":   
            return true;
        }
        return false;        
    }

    mapSurrogate(object, composer) {
        if ($isObject(object)) {
            const surrogateType = surrogate.get($classOf(object));
            if (!$isNothing(surrogateType)) {
                return composer.$bestEffort().$mapFrom(object, surrogateType)
            }
        }
    }
}