import {
    Base, MethodType, $isNothing, $isFunction,
    $isProtocol, $isPromise, createKeyChain
} from "miruken-core";

import Trampoline from "./trampoline";
import Resolving from "./resolving";
import CallbackControl from "./callback-control";
import { $unhandled } from "./callback-policy";
import { CallbackOptions, CallbackSemantics } from "./callback-semantics"
import { NotHandledError } from "./errors";

const _ = createKeyChain();

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
export const HandleMethod = Base.extend(CallbackControl, {
    constructor(methodType, protocol, methodName, args, semantics) {
        if ($isNothing(methodName)) {
            throw new Error("The methodName argument is required");
        }
        if (protocol && !$isProtocol(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        const _this = _(this);
        _this.methodType = methodType;
        _this.protocol   = protocol;
        _this.methodName = methodName;
        _this.args       = args;
        _this.semantics  = semantics || new CallbackSemantics();
    },

    get methodType()          { return _(this).methodType; },
    get protocol()            { return _(this).protocol; },
    get semantics()           { return _(this).semantics; },
    get methodName()          { return _(this).methodName; },
    get args()                { return _(this).args; },
    set args(value)           { _(this).args = value; },
    get returnValue()         { return _(this).returnValue; },
    set returnValue(value)    { _(this).returnValue = value; },
    get exception()           { return _(this).exception; },
    set exception(exception)  { _(this).exception = exception; },          
    get callbackResult()      { return _(this).returnValue; },
    set callbackResult(value) { _(this).returnValue = value; },

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
        if (!this.isAcceptableTarget(target)) return false;
        
        let method, result;
        const { methodName, methodType, args } = this;

        if (methodType === MethodType.Invoke) {
            method = target[methodName];
            if (!$isFunction(method)) return false;
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
            _(this).returnValue = result;
            return true;                        
        } catch (exception) {
            _(this).exception = exception;
            throw exception;
        }
    },
    isAcceptableTarget(target) {
        if (!target) return false;
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
        _(this).resolving = new Resolving(handleMethod.protocol, handleMethod);
    },

    get callbackResult() {
        const result = _(this).resolving.callbackResult;
        if ($isPromise(result)) {
            return result.then(() => {
                if (_(this).resolving.succeeded) {
                    return this.callback.callbackResult;
                }
                throw new NotHandledError(this.callback);
            });
        }
        return this.callback.callbackResult;
    },
    
    dispatch(handler, greedy, composer) {
        return this.base(handler, greedy, composer) ||
               _(this).resolving.dispatch(handler, greedy, composer);          
    }
});

export default HandleMethod;
