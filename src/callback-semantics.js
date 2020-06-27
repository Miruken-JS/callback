import { Flags, createKeyChain } from "miruken-core";
import Handler from "./handler";
import Composition from "./composition";
import { NotHandledError, RejectedError } from "./errors";

const _ = createKeyChain();

/**
 * CallbackOptions flags enum
 * @class CallbackOptions
 * @extends Flags
 */
export const CallbackOptions = Flags({
    /**
     * @property {number} None
     */
    None: 0,
    /**
     * Requires no protocol conformance.
     * @property {number} Duck
     */                
    Duck: 1 << 0,
    /**
     * Requires callback to match exact protocol.
     * @property {number} Strict
     */                
    Strict: 1 << 1,
    /**
     * Delivers callback to all handlers.  At least one must recognize it.
     * @property {number} Broadcast
     */
    Broadcast: 1 << 2,
    /**
     * Marks callback as optional.
     * @property {number} BestEffort
     */        
    BestEffort: 1 << 3,
    /**
     * Publishes callback to all handlers.
     * @property {number} Notify
     */                
    Notify: (1 << 2) | (1 << 3)
});

/**
 * Captures callback semantics.
 * @class CallbackSemantics
 * @constructor
 * @param  {CallbackOptions}  options  -  callback options.
 * @extends Composition
 */
export class CallbackSemantics extends Composition {
    constructor(options) {
        super();
        const _this = _(this);
        _this.options   = CallbackOptions.None.addFlag(options);
        _this.specified = _this.options;
    }

    get canBatch()  { return false }
    get canFilter() { return false }
    get canInfer()  { return false }

    hasOption(options) {
        return _(this).options.hasFlag(options);
    }

    setOption(options, enabled) {
        const _this = _(this);
        _this.options = enabled
            ? _this.options.addFlag(options)
            : _this.options.removeFlag(options);
        _this.specified = _this.specified.addFlag(options);
    }

    isSpecified(options) {
        return _(this).specified.hasFlag(options);
    }

    mergeInto(semantics) {
        const items = CallbackOptions.items;
        for (let i = 0; i < items.length; ++i) {
            const option = +items[i];
            if (this.isSpecified(option) && !semantics.isSpecified(option)) {
                semantics.setOption(option, this.hasOption(option));
            }
        }
    }
}

Handler.implement({
    /**
     * Establishes duck callback semantics.
     * @method $duck
     * @returns {Handler} duck semantics.
     * @for Handler
     */
    $duck() { return this.$callOptions(CallbackOptions.Duck); },
    /**
     * Establishes strict callback semantics.
     * @method $strict
     * @returns {Handler} strict semantics.
     * @for Handler
     */
    $strict() { return this.$callOptions(CallbackOptions.Strict); },  
    /**
     * Establishes broadcast callback semantics.
     * @method $broadcast
     * @returns {Handler} broadcast semanics.
     * @for Handler
     */        
    $broadcast() { return this.$callOptions(CallbackOptions.Broadcast); },
    /**
     * Establishes best-effort callback semantics.
     * @method $bestEffort
     * @returns {Handler} best-effort semanics.
     * @for Handler
     */                
    $bestEffort() { return this.$callOptions(CallbackOptions.BestEffort); },
    /**
     * Establishes notification callback semantics.
     * @method $notify
     * @returns {CallbackOptionsHandler} notification semanics.
     * @for Handler
     */
    $notify() { return this.$callOptions(CallbackOptions.Notify); },
    /**
     * Establishes callback semantics.
     * @method $callOptions
     * @param  {CallbackOptions}  options  -  callback semantics
     * @returns {Handler} custom callback semanics.
     * @for Handler
     */                        
    $callOptions(options) {
        const semantics = new CallbackSemantics(options);
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                if (Composition.isComposed(callback, CallbackSemantics)) {
                    return false;
                }

                if (callback instanceof CallbackSemantics) {
                    semantics.mergeInto(callback);
                    if (greedy) {
                        this.base(callback, greedy, composer);
                    }
                    return true;
                } else if (callback instanceof Composition) {
                    return this.base(callback, greedy, composer);
                }

                if (semantics.isSpecified(CallbackOptions.Broadcast)) {
                    greedy = semantics.hasOption(CallbackOptions.Broadcast);
                }

                if (semantics.isSpecified(CallbackOptions.BestEffort) &&
                    semantics.hasOption(CallbackOptions.BestEffort)) {
                    try {
                        this.base(callback, greedy, composer);
                        return true;
                    } catch (exception) {
                        if (exception instanceof NotHandledError ||
                            exception instanceof RejectedError) {
                            return true;
                        }
                        throw exception;
                    }                   
                }
                
                return this.base(callback, greedy, composer);
            }
        });
    }  
});
