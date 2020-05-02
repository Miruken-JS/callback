import { $flatten } from "miruken-core";
import { Handler, HandlerAdapter } from "./handler";

/**
 * Encapsulates zero or more
 * {{#crossLink "Handler"}}{{/crossLink}}.<br/>
 * See [Composite Pattern](http://en.wikipedia.org/wiki/Composite_pattern)
 * @class CompositeHandler
 * @constructor
 * @param  {Arguments}  arguments  -  callback handlers
 * @extends Handler
 */
export const CompositeHandler = Handler.extend({
    constructor(...handlers) {
        this._handlers = [];
        this.addHandlers(handlers);
    },

    getHandlers() { return this._handlers.slice(); },
    addHandlers(...handlers) {
        handlers = $flatten(handlers, true)
            .filter(h => this.findHandler(h) == null)
            .map(h => h.toHandler());
        this._handlers.push(...handlers);
        return this;
    },
    insertHandlers(atIndex, ...handlers) {
        handlers = $flatten(handlers, true)
            .filter(h => this.findHandler(h) == null)
            .map(h => h.toHandler());
        this._handlers.splice(atIndex, 0, ...handlers);                
        return this;                    
    },                
    removeHandlers(...handlers) {
        $flatten(handlers, true).forEach(handler => {
            const count = this._handlers.length;
            for (let idx = 0; idx < count; ++idx) {
                const testHandler = _handlers[idx];
                if (testHandler === handler || 
                    (testHandler instanceof HandlerAdapter &&
                        testHandler.handler === handler)) {
                    this._handlers.splice(idx, 1);
                    return;
                }
            }
        });
        return this;
    },
    findHandler(handler) {
        for (const h of this._handlers) {
            if (h === handler) return h;
            if (h instanceof HandlerAdapter && h.handler === handler) {
                return h;
            }
        }
    },
    handleCallback(callback, greedy, composer) {
        let handled = this.base(callback, greedy, composer);
        if (handled && !greedy) { return true; }
        for (const handler of this._handlers) {
            if (handler.handleCallback(callback, greedy, composer)) {
                if (!greedy) { return true; }
                handled = true;
            }
        }
        return handled;
    }
});

export default CompositeHandler;