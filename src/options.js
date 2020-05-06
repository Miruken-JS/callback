import { 
    Base, emptyArray, $isNothing, $isFunction,
    getPropertyDescriptors
} from "miruken-core";

export const Options = Base.extend({
    inferCallback() { return this; },
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
            if ($isFunction(keyValue)) { return; }
            if (keyValue !== undefined && this.hasOwnProperty(key)) {
                const optionsValue = options[key];
                if (optionsValue === undefined || !options.hasOwnProperty(key)) {
                    options[key] = _copyOptionsValue(keyValue);
                } else if ($isFunction(keyValue.mergeInto)) {
                    keyValue.mergeInto(optionsValue);
                }
            }
        });
        return true;
    },
    copy() {
        var options = Reflect.construct(this.constructor, emptyArray);
        this.mergeInto(options);
        return options;
    }
}, {
    coerce(...args) { return Reflect.construct(this, args); }
});

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