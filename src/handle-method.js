import {
    Base, MethodType, $isFunction, $isProtocol
} from "miruken-core";

import { DispatchingCallback, $unhandled } from "./callback";
import { CallbackOptions } from "./callback-semantics"
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
        if (protocol && !$isProtocol(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        let _returnValue, _exception;
        this.extend({
            /**
             * Gets the type of method.
             * @property {number} methodType
             * @readOnly
             */
            get methodType() { return methodType; },
            /**
             * Gets the Protocol the method belongs to.
             * @property {Protocol} protocol
             * @readOnly
             */
            get protocol() { return protocol; },
            /**
             * Gets the name of the method.
             * @property {string} methodName
             * @readOnly
             */
            get methodName() { return methodName; },
            /**
             * Gets/sets the arguments of the method.
             * @property {Array} methodArgs
             * @readOnly
             */
            get methodArgs() { return args; },
            set methodArgs(value) { args = value; },
            /**
             * Get/sets the return value of the method.
             * @property {Any} returnValue.
             */
            get returnValue() { return _returnValue; },
            set returnValue(value) { _returnValue = value; },
            /**
             * Gets/sets the execption raised by the method.
             * @property {Any} method exception.
             */
            get exception() { return _exception; },
            set exception(exception) { _exception = exception; },
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */                
            get callbackResult() { return _returnValue; },
            set callbackResult(value) { _returnValue = value; },
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
                    _returnValue = result;
                    return true;                        
                } catch (exception) {
                    _exception = exception;
                    throw exception;
                }
            },
            isAcceptableTarget(target) {
                if (!target) { return false; }
                if (!protocol) { return true; }
                return semantics.hasOption(CallbackOptions.Strict)
                     ? protocol.isToplevel(target)
                     : semantics.hasOption(CallbackOptions.Duck)
                    || protocol.isAdoptedBy(target);
            },
            notHandledError() {
                let qualifier = "";
                switch (methodType) {
                case MethodType.Get:
                    qualifier = " (get)";
                    break;
                case MethodType.Set:
                    qualifier = " (set)";
                    break;                    
                }
                return new TypeError(`Protocol ${protocol.name}:${methodName}${qualifier} could not be handled.`);
            },
            dispatch(handler, greedy, composer) {
                return this.invokeOn(handler, composer);
            }
        });
    }
});

export default HandleMethod;
