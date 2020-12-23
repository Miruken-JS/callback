import { 
    Base, emptyArray, conformsTo,
    $isNothing, $isFunction, $optional,
    getPropertyDescriptors, createTypeInfoDecorator,
    createKey
} from "miruken-core";

import { KeyResolving } from "./key-resolving";

const _ = createKey();

export class Options extends Base {
    get canBatch()  { return false; }
    get canFilter() { return false; }
    get canInfer()  { return false; }

    /**
     * Merges this options data into `options`.
     * @method mergeInto
     * @param   {Options}  options  -  options to receive data
     * @returns {boolean} true if options could be merged into.
     */
    mergeInto(options) {
        if (!(options instanceof this.constructor)) {
            return false;
        }
        const descriptors = getPropertyDescriptors(this),
              keys        = Reflect.ownKeys(descriptors);
        keys.forEach(key => {
            if (Reflect.has(Options.prototype, key)) return;
            const keyValue   = this[key],
                  descriptor = descriptors[key];
            if (keyValue !== undefined) {
                const optionsValue = options[key];
                if (optionsValue === undefined || !options.hasOwnProperty(key)) {
                    options[key] = copyOptionsValue(keyValue);
                } else {
                    this.mergeKeyInto(options, key, keyValue, optionsValue);
                }
            }
        });
        return true;
    }

    mergeKeyInto(options, key, keyValue, optionsValue) {
        if (Array.isArray(keyValue)) {
            options[key] = options[key].concat(copyOptionsValue(keyValue));
            return;
        }
        const mergeInto = keyValue.mergeInto;
        if ($isFunction(mergeInto)) {
            mergeInto.call(keyValue, optionsValue);
        }
    }

    copy() {
        var options = Reflect.construct(this.constructor, emptyArray);
        this.mergeInto(options);
        return options;
    }
}

function copyOptionsValue(optionsValue) {
    if ($isNothing(optionsValue)) {
        return optionsValue;
    }
    if (Array.isArray(optionsValue)) {
        return optionsValue.map(copyOptionsValue);
    }
    if ($isFunction(optionsValue.copy)) {
        return optionsValue.copy();
    }
    return optionsValue;
}

@conformsTo(KeyResolving)
export class OptionsResolver {
    constructor(optionsType) {
        _(this).optionsType = optionsType;
    }

    validate(typeInfo) {
        const optionsType = _(this).optionsType || typeInfo.type;
        if ($isNothing(optionsType)) {
            throw new TypeError("Unable to determine @options argument type.");
        }
        if (!(optionsType.prototype instanceof Options)) {
            throw new TypeError(`@options requires an Options argument, but found '${optionsType.name}'.`);
        }
    }

    resolve(typeInfo, handler) {
        const optionsType = _(this).optionsType || typeInfo.type,
              options     = handler.$getOptions(optionsType);
        return $isNothing(options) ? $optional(options) : options;
    }
}

export const options = createTypeInfoDecorator((key, typeInfo, [optionsType]) => {
    typeInfo.keyResolver = new OptionsResolver(optionsType);
});
