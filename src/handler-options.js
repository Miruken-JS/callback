import { $isNothing, $isFunction } from "miruken-core";
import { Handler } from "./handler";
import { Options } from "./options";
import { handles } from "./callback-policy";

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
        throw new TypeError("The Options key is required.");
    }

    const actualKey = optionsKey.startsWith("$") ? optionsKey
                    : `$${optionsKey}`;

    if (Handler.prototype.hasOwnProperty(actualKey)) {
        throw new Error(`Options key '${optionsKey}' is already defined.`);
    }

    Handler.implement({
        [actualKey](options) {
            if ($isNothing(options)) return this;
            if (!(options instanceof optionsType)) {
                options = Reflect.construct(optionsType, [])
                    .extend(options);
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
    $getOptions(optionsType) {
        validateOptionsType(optionsType);
        const options = new optionsType();
        return this.handle(options, true) ? options : null;
    }
});

export function handlesOptions(optionsKey) {
    if ($isFunction(optionsKey)) {
        throw new SyntaxError("@handlesOptions requires an options key argument");
    }
    return (target, key, descriptor) => {
        if ($isNothing(descriptor)) {
            Handler.registerOptions(target, optionsKey);
        } else {
            throw new SyntaxError("@handlesOptions can only be applied to classes.");
        }
    };
}

function validateOptionsType(optionsType) {
    if ($isNothing(optionsType)) {
        throw new TypeError("No Options type specified.");
    }
    if (!$isFunction(optionsType) || !(optionsType.prototype instanceof Options)) {
        throw new TypeError(`Options type '${optionsType}' does not extend Options.`);
    }
}
