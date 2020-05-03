import {
    MethodType, Delegate, StrictProtocol,
    ResolvingProtocol, DuckTyping, $isPromise
} from "miruken-core";

import Handler from "./handler";
import HandleMethod from "./handle-method";
import { CallbackOptions, CallbackSemantics } from "./callback-semantics"
import { NotHandledError } from "./errors";

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

    if (ResolvingProtocol.isAdoptedBy(protocol)) {
        if (semantics.isSpecified(CallbackOptions.Broadcast)) {
            options |= CallbackOptions.Broadcast
        }
    }

    if (options != CallbackOptions.None)
    {
        semantics.setOption(options, true);
        handler = handler.$callOptions(options);
    }

    const handleMethod = new HandleMethod(
        methodType, protocol, methodName, args, semantics);

    if (!handler.handle(handleMethod)) {
        throw handleMethod.notHandledError();
    }

    const result = handleMethod.callbackResult;
    if (!$isPromise(result)) return result;
    return result.catch(error => {
        if (error instanceof NotHandledError) {
            if (!(semantics.isSpecified(CallbackOptions.BestEffort) &&
                semantics.hasOption(CallbackOptions.BestEffort))) {
                throw handleMethod.notHandledError();
            }
        } else {
            throw error;
        }
    });
}

Handler.implement({
    /**
     * Converts the callback handler to a {{#crossLink "Delegate"}}{{/crossLink}}.
     * @method toDelegate
     * @returns {InvocationDelegate}  delegate for this callback handler.
     */            
    toDelegate() { return new InvocationDelegate(this); }
});