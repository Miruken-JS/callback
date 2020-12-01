import { $isNothing, $isFunction } from "miruken-core";
import { Handler } from "../handler";
import { MapTo, MapFrom } from "./map-callback";
import { NotHandledError } from "../errors";

Handler.implement({
    /**
     * Maps the `object` to a value in `format`.
     * @method mapFrom
     * @param   {Object}    object     -  object to map
     * @param   {Any}       format     -  format specifier
     * @param   {Function}  configure  -  configure options
     * @returns {Any}  mapped value.
     * @for Handler
     */
    mapFrom(object, format, configure) {
        if ($isNothing(object)) {
            throw new TypeError("The object argument is required.");
        }
        if (!$isNothing(configure) && !$isFunction(configure)) {
            throw new TypeError("The configure argument is not a function.");
        }
        const mapFrom = new MapFrom(object, format);
        configure?.(mapFrom);
        if (!this.handle(mapFrom)) {
            throw new NotHandledError(mapFrom);
        }
        return mapFrom.callbackResult;
    },
    /**
     * Maps the formatted `value` in `format` to `classOrInstance`.
     * @method mapTo 
     * @param   {Any}              value            -  formatted value
     * @param   {Any}              format           -  format specifier
     * @param   {Function|Object}  classOrInstance  -  instance or class to unmap
     * @param   {Function}         configure        -  configure options
     * @return  {Object}  unmapped instance.
     * @for Handler
     */    
    mapTo(value, format, classOrInstance, configure) {
        if ($isNothing(value)) {
             throw new TypeError("The object argument is required.");
        }
        if (!$isNothing(configure) && !$isFunction(configure)) {
            throw new TypeError("The configure argument is not a function.");
        }
        if (Array.isArray(classOrInstance)) {
            const type = classOrInstance[0];
            if (type && !$isFunction(type) && !Array.isArray(type)) {
                throw new TypeError("Cannot infer array type.");
            }
        } else if (Array.isArray(value) && $isFunction(classOrInstance)) {
            classOrInstance = [classOrInstance];
        }
        const mapTo = new MapTo(value, format, classOrInstance);
        configure?.(mapTo);
        if (!this.handle(mapTo)) {
            throw new NotHandledError(mapTo);
        }
        return mapTo.callbackResult; 
    }    
});
