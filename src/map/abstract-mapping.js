import { typeOf, $isFunction } from "miruken-core";
import { Handler } from "../handler";
import { $unhandled } from "../callback-policy";
import { mapsFrom, mapsTo } from "./maps";
import { MapOptions } from "./map-options";
import { unmanaged } from "../unmanaged";
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
}