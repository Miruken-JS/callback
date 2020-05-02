import { Flags } from "miruken-core";
import Handler from "./handler";
import Composition from "./composition";
import { RejectedError } from "./errors";

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
export const CallbackSemantics = Composition.extend({
    constructor(options) {
        this._options   = CallbackOptions.None.addFlag(options);
        this._specified = this._options;
    },

    hasOption(options) {
        return this._options.hasFlag(options);
    },              
    setOption(options, enabled) {
        this._options = enabled
                    ? this._options.addFlag(options)
                    : this._options.removeFlag(options);
        this._specified = this._specified.addFlag(options);
    },              
    isSpecified(options) {
        return this._specified.hasFlag(options);
    },                  
    mergeInto(semantics) {
        const items = CallbackOptions.items;
        for (let i = 0; i < items.length; ++i) {
            const option = +items[i];
            if (this.isSpecified(option) && !semantics.isSpecified(option)) {
                semantics.setOption(option, this.hasOption(option));
            }
        }
    }
});

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
     * Establishes custom callback semantics.
     * @method $callOptions
     * @param  {CallbackOptions}  options  -  callback semantics
     * @returns {Handler} custom callback semanics.
     * @for Handler
     */                        
    $callOptions(options) {
        const semantics = new CallbackSemantics(options);
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                let handled = false;
                if (Composition.isComposed(callback, CallbackSemantics)) {
                    return false;
                }
                if (callback instanceof CallbackSemantics) {
                    semantics.mergeInto(callback);
                    handled = true;
                } else if (!greedy) {
                    if (semantics.isSpecified(CallbackOptions.Broadcast)) {
                        greedy = semantics.hasOption(CallbackOptions.Broadcast);
                    } else {
                        const cs = new CallbackSemantics();
                        if (this.handle(cs, true) &&
                            cs.isSpecified(CallbackOptions.Broadcast)) {
                            greedy = cs.hasOption(CallbackOptions.Broadcast);
                        }
                    }
                }
                if (greedy || !handled) {
                    handled = this.base(callback, greedy, composer) || handled;
                }
                return !!handled;
            }
        });
    }  
});
