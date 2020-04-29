import { $flatten } from "miruken-core";
import Handler from "./handler";

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
        let _handlers = [];
        this.extend({
            /**
             * Gets all participating callback handlers.
             * @method getHandlers
             * @returns {Array} participating callback handlers.
             */
            getHandlers() { return _handlers.slice(); },
            /**
             * Adds the callback handlers to the composite.
             * @method addHandlers
             * @param   {Any}  ...handlers  -  handlers to add
             * @returns {CompositeHandler}  composite
             * @chainable
             */
            addHandlers(...handlers) {
                handlers = $flatten(handlers, true).map(h => h.toHandler());
                _handlers.push(...handlers);
                return this;
            },
            /**
             * Adds the callback handlers to the composite.
             * @method addHandlers
             * @param   {number}  atIndex      -  index to insert at
             * @param   {Any}     ...handlers  -  handlers to insert
             * @returns {CompositeHandler}  composite
             * @chainable
             */
            insertHandlers(atIndex, ...handlers) {
                handlers = $flatten(handlers, true).map(h => h.toHandler());
                _handlers.splice(atIndex, 0, ...handlers);                
                return this;                    
            },                
            /**
             * Removes callback handlers from the composite.
             * @method removeHandlers
             * @param   {Any}  ...handlers  -  handlers to remove
             * @returns {CompositeHandler}  composite
             * @chainable
             */
            removeHandlers(...handlers) {
                $flatten(handlers).forEach(handler => {
                    if (!handler) {
                        return;
                    }
                    const count = _handlers.length;
                    for (let idx = 0; idx < count; ++idx) {
                        const testHandler = _handlers[idx];
                        if (testHandler == handler || testHandler.handler == handler) {
                            _handlers.splice(idx, 1);
                            return;
                        }
                    }
                });
                return this;
            },
            handleCallback(callback, greedy, composer) {
                let handled = this.base(callback, greedy, composer);
                if (handled && !greedy) { return true; }
                let count   = _handlers.length;
                for (let idx = 0; idx < count; ++idx) {
                    const handler = _handlers[idx];
                    if (handler.handleCallback(callback, greedy, composer)) {
                        if (!greedy) { return true; }
                        handled = true;
                    }
                }
                return handled;
            }
        });
        this.addHandlers(handlers);
    }
});

export default CompositeHandler;