import { $isNothing } from "miruken-core";
import Handler from "./handler";

/**
 * Represents a two-way
 * {{#crossLink "Handler"}}{{/crossLink}} path.
 * @class CascadeHandler
 * @constructor
 * @param  {Handler}  handler           -  primary handler
 * @param  {Handler}  cascadeToHandler  -  secondary handler
 * @extends Handler
 */
export const CascadeHandler = Handler.extend({
    constructor(handler, cascadeToHandler) {
        if ($isNothing(handler)) {
            throw new TypeError("No handler specified.");
        } else if ($isNothing(cascadeToHandler)) {
            throw new TypeError("No cascadeToHandler specified.");
        }
        Object.defineProperties(this, {
            handler:  {
                value:    handler.toHandler(),
                writable: false
            },         
            cascadeToHandler: {
                value:    cascadeToHandler.toHandler(),
                writable: false
            }
        });
    },
    handleCallback(callback, greedy, composer) {
        let handled = this.base(callback, greedy, composer);
        return !!(greedy
            ? handled | (this.handler.handleCallback(callback, true, composer)
               | this.cascadeToHandler.handleCallback(callback, true, composer))
            : handled || (this.handler.handleCallback(callback, false, composer)
               || this.cascadeToHandler.handleCallback(callback, false, composer)));
    }
});

export default CascadeHandler;