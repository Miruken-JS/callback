import { $isNothing, $isFunction } from "miruken-core";
import { Handler } from "../handler";
import { MapTo, MapFrom } from "./map-callback";
import { NotHandledError } from "../errors";
import "./map-options";

Handler.implement({
    /**
     * Maps the `object` to a value in `format`.
     * @method $mapFrom
     * @param   {Object}  object  -  object to map
     * @param   {Any}     format  -  format specifier
     * @param   {Array}   seen    -  array of seen objects
     * @returns {Any}  mapped value.
     * @for Handler
     */
    $mapFrom(object, format, seen) {
        if ($isNothing(object)) {
            throw new TypeError("The object argument is required.");
        }
        const mapFrom = new MapFrom(object, format, seen);
        if (!this.handle(mapFrom)) {
            throw new NotHandledError(mapFrom);
        }
        return mapFrom.callbackResult;
    },
    /**
     * Maps the formatted `value` in `format` to `classOrInstance`.
     * @method $mapTo 
     * @param   {Any}              value            -  formatted value
     * @param   {Any}              format           -  format specifier
     * @param   {Function|Object}  classOrInstance  -  instance or class to unmap
     * @param   {Array}            seen             -  array of seen objects
     * @return  {Object}  unmapped instance.
     * @for Handler
     */    
    $mapTo(value, format, classOrInstance, seen) {
        if ($isNothing(value)) {
             throw new TypeError("The object argument is required.");
        }
        if (Array.isArray(classOrInstance)) {
            const type = classOrInstance[0];
            if (type && !$isFunction(type) && !Array.isArray(type)) {
                throw new TypeError("Cannot infer array type.");
            }
        } else if (Array.isArray(value) && $isFunction(classOrInstance)) {
            classOrInstance = [classOrInstance];
        }
        const mapTo = new MapTo(value, format, classOrInstance, seen);
        if (!this.handle(mapTo)) {
            throw new NotHandledError(mapTo);
        }
        return mapTo.callbackResult; 
    }    
});
