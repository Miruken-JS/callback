import { 
    Base, emptyArray, $isNothing,
    $isFunction, getPropertyDescriptors
} from "miruken-core";

export class Options extends Base {
    get canBatch()  { return false }
    get canFilter() { return false }
    get canInfer()  { return false }

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
            const keyValue = this[key];
            if (Reflect.has(Options.prototype, key) || $isFunction(keyValue)) { 
                return;
            }
            if (keyValue !== undefined && this.hasOwnProperty(key)) {
                const optionsValue = options[key];
                if (optionsValue === undefined || !options.hasOwnProperty(key)) {
                    options[key] = _copyOptionsValue(keyValue);
                } else {
                    this.mergeKeyInto(options, key, keyValue, optionsValue);
                }
            }
        });
        return true;
    }

    mergeKeyInto(options, key, keyValue, optionsValue) {
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

function _copyOptionsValue(optionsValue) {
    if ($isNothing(optionsValue)) {
        return optionsValue;
    }
    if (Array.isArray(optionsValue)) {
        return optionsValue.map(_copyOptionsValue);
    }
    if ($isFunction(optionsValue.copy)) {
        return optionsValue.copy();
    }
    return optionsValue;
}

export default Options;
