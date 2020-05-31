import { $flatten, createKeyChain } from "miruken-core";
import { Handler, HandlerAdapter } from "./handler";

const _ = createKeyChain();

/**
 * Encapsulates zero or more
 * {{#crossLink "Handler"}}{{/crossLink}}.<br/>
 * See [Composite Pattern](http://en.wikipedia.org/wiki/Composite_pattern)
 * @class CompositeHandler
 * @constructor
 * @param  {Any}  [...handlers]  -  callback handlers
 * @extends Handler
 */
export const CompositeHandler = Handler.extend({
    constructor(...handlers) {
        _(this).handlers = [];
        this.addHandlers(handlers);
    },

    getHandlers() { 
        return _(this).handlers.slice();
    },
    addHandlers(...handlers) {
        handlers = $flatten(handlers, true)
            .filter(h => this.findHandler(h) == null)
            .map(h => h.toHandler());
        _(this).handlers.push(...handlers);
        return this;
    },
    insertHandlers(atIndex, ...handlers) {
        handlers = $flatten(handlers, true)
            .filter(h => this.findHandler(h) == null)
            .map(h => h.toHandler());
        _(this).handlers.splice(atIndex, 0, ...handlers);                
        return this;                    
    },                
    removeHandlers(...handlers) {
        $flatten(handlers, true).forEach(handler => {
            const handlers = _(this).handlers,
                  count    = handlers.length;
            for (let idx = 0; idx < count; ++idx) {
                const testHandler = handlers[idx];
                if (testHandler === handler || 
                    (testHandler instanceof HandlerAdapter &&
                        testHandler.handler === handler)) {
                    handlers.splice(idx, 1);
                    return;
                }
            }
        });
        return this;
    },
    findHandler(handler) {
        for (const h of _(this).handlers) {
            if (h === handler) return h;
            if (h instanceof HandlerAdapter && h.handler === handler) {
                return h;
            }
        }
    },
    handleCallback(callback, greedy, composer) {
        let handled = this.base(callback, greedy, composer);
        if (handled && !greedy) return true;
        for (const handler of _(this).handlers) {
            if (handler.handle(callback, greedy, composer)) {
                if (!greedy) return true;
                handled = true;
            }
        }
        return handled;
    }
});

export default CompositeHandler;