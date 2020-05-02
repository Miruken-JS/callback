import {
    Base, MethodType, $isFunction, $isProtocol
} from "miruken-core";

import { DispatchingCallback, $unhandled } from "./callback";
import { CallbackOptions, CallbackSemantics } from "./callback-semantics"
import "./handler";

/**
 * Invokes a method on a target.
 * @class HandleMethod
 * @constructor
 * @param  {number}              methodType  -  get, set or invoke
 * @param  {Protocol}            protocol    -  initiating protocol
 * @param  {string}              methodName  -  method name
 * @param  {Any}                 args        -  method or property arguments
 * @param  {InvocationSemanics}  semantics   -  invocation semantics
 * @extends Base
 */
export const HandleMethod = Base.extend(DispatchingCallback, {
    constructor(methodType, protocol, methodName, args, semantics) {
        if (methodName == null) {
            throw new Error("Method name is required");
        }
        if (protocol && !$isProtocol(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        this._methodType = methodType;
        this._protocol   = protocol;
        this._methodName = methodName;
        this._args       = args;
        this._semantics  = semantics || new CallbackSemantics();
    },

    get methodType() { return this._methodType; },
    get protocol() { return this._protocol; },
    get semantics() { return this._semantics; },
    get methodName() { return this._methodName; },
    get args() { return this._args; },
    set args(value) { this._args = value; },
    get returnValue() { return this._returnValue; },
    set returnValue(value) { this._returnValue = value; },
    get exception() { return this._exception; },
    set exception(exception) { this._exception = exception; },          
    get callbackResult() { return this._returnValue; },
    set callbackResult(value) { this._returnValue = value; },

    /**
     * Attempts to invoke the method on the target.<br/>
     * During invocation, the receiver will have access to the ambient **$composer** property
     * representing the initiating {{#crossLink "Handler"}}{{/crossLink}}.
     * @method invokeOn
     * @param   {Object}   target    -  method receiver
     * @param   {Handler}  composer  -  composition handler
     * @returns {boolean} true if the method was accepted.
     */
    invokeOn(target, composer) {
        if (!this.isAcceptableTarget(target)) { return false; }
        
        let method, result;
        const { methodName, methodType, args } = this;

        if (methodType === MethodType.Invoke) {
            method = target[methodName];
            if (!$isFunction(method)) { return false; }
        }

        try {
            switch (methodType) {
            case MethodType.Get:
                result = composer != null
                       ? composer.$compose(() => target[methodName])
                       : target[methodName];
                ;
                break;
            case MethodType.Set:
                result = composer != null
                       ? composer.$compose(() => target[methodName] = args)
                       : target[methodName] = args;
                break;
            case MethodType.Invoke:
                result = composer != null
                       ? composer.$compose(() => method.apply(target, args))
                       : method.apply(target, args);
                break;
            }
            if (result === $unhandled) {
                return false;
            }
            this._returnValue = result;
            return true;                        
        } catch (exception) {
            this._exception = exception;
            throw exception;
        }
    },
    isAcceptableTarget(target) {
        if (!target) { return false; }
        if (!this.protocol) { return true; }
        return this.semantics.hasOption(CallbackOptions.Strict)
                ? this.protocol.isToplevel(target)
                : this.semantics.hasOption(CallbackOptions.Duck)
            || this.protocol.isAdoptedBy(target);
    },
    notHandledError() {
        let qualifier = "";
        switch (this.methodType) {
        case MethodType.Get:
            qualifier = " (get)";
            break;
        case MethodType.Set:
            qualifier = " (set)";
            break;                    
        }
        return new TypeError(`Protocol ${this.protocol.name}:${this.methodName}${qualifier} could not be handled.`);
    },
    dispatch(handler, greedy, composer) {
        return this.invokeOn(handler, composer);
    }    
});

export default HandleMethod;
