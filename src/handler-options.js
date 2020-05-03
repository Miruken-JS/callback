import { 
    Options, $isFunction, $isNothing, $isClass
} from "miruken-core";

import Handler from "./handler";
import { handles } from "./policy";

/**
 * Register the options to be applied by a Handler.
 * @method registerOptions
 * @static
 * @param   {Function}        optionsType  -  type of options
 * @param   {string|symbol}   optionsKey   -  options key  
 * @returns {boolean} true if successful, false otherwise.
 * @for Handler
 */ 
Handler.registerOptions = function (optionsType, optionsKey) {
    validateOptionsType(optionsType);

    if ($isNothing(optionsKey)) {
        throw new TypeError("No Options key specified.");
    }

    if (Handler.prototype.hasOwnProperty(optionsKey)) {
        return false;
    }

    Handler.implement({
        [optionsKey](options) {
            if ($isNothing(options)) return this;
            if (!(options instanceof optionsType)) {
                options = Reflect.construct(optionsType, [options]);
            }
            return this.decorate({
                @handles(optionsType)
                mergePolicy(receiver) {
                    options.mergeInto(receiver)                
                }
            });
        }
    });
    return true;
}

Handler.implement({
    getOptions(optionsType) {
        validateOptionsType(optionsType);
        const options = new optionsType();
        return this.handle(options, true) ? options : null;
    }
});

function validateOptionsType(optionsType) {
    if ($isNothing(optionsType)) {
        throw new TypeError("No Options type specified.");
    }
    if (!$isClass(optionsType) || !(optionsType.prototype instanceof Options)) {
        throw new TypeError(`Options type '${optionsType}' does not extend Options.`);
    }
}