import {
    MethodType, Delegate, Protocol,
    StrictProtocol, ResolvingProtocol,
    DuckTyping, $isPromise, createKeyChain
} from "miruken-core";

import Handler from "./handler";
import HandleMethod from "./handle-method";
import { CallbackOptions, CallbackSemantics } from "./callback-semantics"
import { NotHandledError } from "./errors";

const _ = createKeyChain();

/**
 * Delegates properties and methods to a callback handler using 
 * {{#crossLink "HandleMethod"}}{{/crossLink}}.
 * @class HandleMethodDelegate
 * @constructor
 * @param   {Handler}  handler  -  forwarding handler 
 * @extends Delegate
 */
export class HandleMethodDelegate extends Delegate {
    constructor(handler) {
        super();
        _(this).handler = handler;
    }
    
    get handler() { return _(this).handler; }

    get(protocol, propertyName) {
        return delegate(this, MethodType.Get, protocol, propertyName, null);
    }

    set(protocol, propertyName, propertyValue) {
        return delegate(this, MethodType.Set, protocol, propertyName, propertyValue);
    }

    invoke(protocol, methodName, args) {
        return delegate(this, MethodType.Invoke, protocol, methodName, args);
    }
}

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
            methodType, protocol, methodName, args, semantics),
          inference    = handleMethod.inferCallback();

    if (!handler.handle(inference)) {
        throw handleMethod.notHandledError();
    }

    const result = inference.callbackResult;
    
    if ($isPromise(result)) {
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

    return result;
}

Handler.implement({
    /**
     * Converts the callback handler to a {{#crossLink "Delegate"}}{{/crossLink}}.
     * @method toDelegate
     * @returns {HandleMethodDelegate}  delegate for this callback handler.
     */            
    toDelegate() { return new HandleMethodDelegate(this); },

    /**
     * Creates a proxy for this Handler over the `protocol`.
     * @method proxy
     * @param   {Protocol}  protocol  -  the protocol to proxy.
     * @returns {Protocol}  an instance of the protocol bound to this handler.
     */   
    proxy(protocol) {
        if (!Protocol.isProtocol(protocol)) {
            throw new TypeError("The protocol is not valid.");
        }
        return new protocol(new HandleMethodDelegate(this));
    }
});
