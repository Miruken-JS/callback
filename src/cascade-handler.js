import { $isNothing } from "miruken-core";
import { Handler } from "./handler";
import { unmanaged } from "./unmanaged";

/**
 * Represents a two-way
 * {{#crossLink "Handler"}}{{/crossLink}} path.
 * @class CascadeHandler
 * @constructor
 * @param  {Handler}  handler           -  primary handler
 * @param  {Handler}  cascadeToHandler  -  secondary handler
 * @extends Handler
 */
@unmanaged
export class CascadeHandler extends Handler {
    constructor(handler, cascadeToHandler) {
        if ($isNothing(handler)) {
            throw new TypeError("No handler specified.");
        } else if ($isNothing(cascadeToHandler)) {
            throw new TypeError("No cascadeToHandler specified.");
        }
        super();
        Object.defineProperties(this, {
            handler:  {
                value:    Handler.for(handler),
                writable: false
            },         
            cascadeToHandler: {
                value:    Handler.for(cascadeToHandler),
                writable: false
            }
        });
    }

    handleCallback(callback, greedy, composer) {
        let handled = super.handleCallback(callback, greedy, composer);
        return !!(greedy
            ? handled | (this.handler.handle(callback, true, composer)
               | this.cascadeToHandler.handle(callback, true, composer))
            : handled || (this.handler.handle(callback, false, composer)
               || this.cascadeToHandler.handle(callback, false, composer)));
    }
}
