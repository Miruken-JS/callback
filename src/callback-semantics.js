import { Flags } from "miruken-core";
import { Composition, Handler } from "./handler";
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
        let _options   = CallbackOptions.None.addFlag(options),
            _specified = _options;
        this.extend({
            /**
             * Tests the callback options.
             * @method hasOption
             * @param   {CallbackOptions} options  -  options to test
             * @returns {boolean} true if callback options enabled, false otherwise.
             */
            hasOption(options) {
                return _options.hasFlag(options);
            },
            /**
             * Sets the callback options.
             * @method setOption
             * @param   {CallbackOptions} options  -  options to set
             * @param   {boolean}  enabled  -  true if enable options, false to clear.
             */                
            setOption(options, enabled) {
                _options = enabled
                         ? _options.addFlag(options)
                         : _options.removeFlag(options);
                _specified = _specified.addFlag(options);
            },
            /**
             * Determines if the callback options were specified.
             * @method isSpecified
             * @param   {CallbackOptions} options  -  options to test
             * @returns {boolean} true if callback option specified, false otherwise.
             */                
            isSpecified(options) {
                return _specified.hasFlag(options);
            }
        });
    },
    /**
     * Merges callback options into the supplied constraints. 
     * @method mergeInto
     * @param   {CallbackSemantics}  semantics  -  receives callback semantics
     */                
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
