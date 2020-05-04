import {
    Base, MethodType, $isNothing, $isFunction,
    $isProtocol, $isPromise
} from "miruken-core";

import Trampoline from "./trampoline";
import Resolving from "./resolving";
import { DispatchingCallback, $unhandled } from "./policy";
import { CallbackOptions, CallbackSemantics } from "./callback-semantics"
import { NotHandledError } from "./errors";

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
        if ($isNothing(methodName)) {
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

    inferCallback() {
         return new HandleMethodInference(this);
    },
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

 const HandleMethodInference = Trampoline.extend({
    constructor(handleMethod) {
        this.base(handleMethod);
        this._resolving = new Resolving(handleMethod.protocol, handleMethod);
    },

    inferCallback() { return this; },
    completeCallback() {
        const callback  = this.callback,
              resolving = this._resolving,
              result    = resolving.callbackResult;
        if ($isPromise(result)) {
            callback.callbackResult = result.then(() => {
                if (resolving.succeeded) {
                    return resolving.successfulCallbackResult;
                }
                throw new NotHandledError(callback);
            });
        }
    },
    dispatch(handler, greedy, composer) {
        return this.base(handler, greedy, composer) ||
               this._resolving.dispatch(handler, greedy, composer);          
    }
});

export default HandleMethod;
