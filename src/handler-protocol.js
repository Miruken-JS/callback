import {
    MethodType, Delegate, StrictProtocol,
    DuckTyping, $isString, $isFunction
} from "miruken-core";

import HandleMethod from "./handle-method";
import ResolveMethod from "./resolve-method";
import Handler from "./handler";
import { CallbackOptions, CallbackSemantics } from "./callback-semantics"

/**
 * Delegates properties and methods to a callback handler using 
 * {{#crossLink "HandleMethod"}}{{/crossLink}}.
 * @class InvocationDelegate
 * @constructor
 * @param   {Handler}  handler  -  forwarding handler 
 * @extends Delegate
 */
export const InvocationDelegate = Delegate.extend({
    constructor(handler) {
        this.extend({
            get handler() { return handler; }
        });
    },
    get(protocol, propertyName) {
        return delegate(this, MethodType.Get, protocol, propertyName, null);
    },
    set(protocol, propertyName, propertyValue) {
        return delegate(this, MethodType.Set, protocol, propertyName, propertyValue);
    },
    invoke(protocol, methodName, args) {
        return delegate(this, MethodType.Invoke, protocol, methodName, args);
    }
});

function delegate(delegate, methodType, protocol, methodName, args) {
    let handler   = delegate.handler,
        options   = CallbackOptions.None,
        semantics = new CallbackSemantics();
    handler.handle(semantics, true);

    if (!semantics.isSpecified(CallbackOptions.Duck)
        && DuckTyping.isAdoptedBy(protocol))
        options |= CallbackOptions.Duck;
    
    if (!semantics.isSpecified(CallbackOptions.Strict)
        && StrictProtocol.isAdoptedBy(protocol))
        options |= CallbackOptions.Strict;

    if (options != CallbackOptions.None)
    {
        semantics.setOption(options, true);
        handler = handler.$callOptions(options);
    }

    const broadcast    = semantics.hasOption(CallbackOptions.Broadcast),
          bestEffort   = semantics.hasOption(CallbackOptions.BestEffort),
          handleMethod = new HandleMethod(methodType, protocol, methodName, args, semantics);

    if (handler.handle(handleMethod, broadcast)) {
        return handleMethod.callbackResult;
    }

    const resolveMethod = new ResolveMethod(protocol, broadcast, handleMethod, bestEffort);
    if (!handler.handle(resolveMethod, broadcast) && !bestEffort) {
        throw handleMethod.notHandledError();
    }
    
    return resolveMethod.callbackResult;
}

Handler.implement({
    /**
     * Converts the callback handler to a {{#crossLink "Delegate"}}{{/crossLink}}.
     * @method toDelegate
     * @returns {InvocationDelegate}  delegate for this callback handler.
     */            
    toDelegate() { return new InvocationDelegate(this); }
});

/**
 * Shortcut for handling a 
 * {{#crossLink "HandleMethod"}}{{/crossLink}} callback.
 * @method
 * @static
 * @param  {string}    methodName  -  method name
 * @param  {Function}  method      -  method function
 * @returns {Handler} method handler.
 * @for Handler
 */
Handler.implementing = function (methodName, method) {
    if (!$isString(methodName) || methodName.length === 0 || !methodName.trim()) {
        throw new TypeError("No methodName specified.");
    } else if (!$isFunction(method)) {
        throw new TypeError(`Invalid method: ${method} is not a function.`);
    }
    return (new Handler()).extend({
        handleCallback(callback, greedy, composer) {
            if (callback instanceof HandleMethod) {
                return callback.invokeOn({
                    [methodName]: method
                }, composer);
            }
            return false;
        }
    });
};
