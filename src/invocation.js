import {
    Base, Flags, MethodType,Delegate,
    StrictProtocol, DuckTyping, Resolving,
    $isString, $isFunction, $isProtocol,
    $isPromise
} from "miruken-core";

import Resolution from "./resolution";
import { Composition, Handler } from "./handler";
import { handles } from "./policy";
import { DispatchingCallback, $unhandled } from "./callback";

export let $composer;

/**
 * InvocationOptions flags enum
 * @class InvocationOptions
 * @extends Flags
 */
export const InvocationOptions = Flags({
    /**
     * @property {number} None
     */
    None: 0,
    /**
     * Requires no protocol conformance.
     * @property {number} Duck
     */                
    Duck: 1 << 0,
    /**
     * Requires invocation to match exact protocol.
     * @property {number} Strict
     */                
    Strict: 1 << 1,
    /**
     * Delivers invocation to all handlers.  At least one must recognize it.
     * @property {number} Broadcast
     */
    Broadcast: 1 << 2,
    /**
     * Marks invocation as optional.
     * @property {number} BestEffort
     */        
    BestEffort: 1 << 3,
    /**
     * Publishes invocation to all handlers.
     * @property {number} Notify
     */                
    Notify: (1 << 2) | (1 << 3)
});

/**
 * Captures invocation semantics.
 * @class InvocationSemantics
 * @constructor
 * @param  {InvocationOptions}  options  -  invocation options.
 * @extends Base
 */
export const InvocationSemantics = Composition.extend({
    constructor(options) {
        let _options   = InvocationOptions.None.addFlag(options),
            _specified = _options;
        this.extend({
            /**
             * Gets the invocation option.
             * @method getOption
             * @param   {InvocationOption} option  -  option to test
             * @returns {boolean} true if invocation option enabled, false otherwise.
             */
            getOption(option) {
                return _options.hasFlag(option);
            },
            /**
             * Sets the invocation option.
             * @method setOption
             * @param   {InvocationOption} option  -  option to set
             * @param   {boolean}  enabled  -  true if enable option, false to clear.
             */                
            setOption(option, enabled) {
                _options = enabled
                         ? _options.addFlag(option)
                         : _options.removeFlag(option);
                _specified = _specified.addFlag(option);
            },
            /**
             * Determines if the invocation option was specified.
             * @method getOption
             * @param   {InvocationOption} option  -  option to test
             * @returns {boolean} true if invocation option specified, false otherwise.
             */                
            isSpecified(option) {
                return _specified.hasFlag(option);
            }
        });
    },
    /**
     * Merges invocation options into the supplied constraints. 
     * @method mergeInto
     * @param   {InvocationSemantics}  semantics  -  receives invocation semantics
     */                
    mergeInto(semantics) {
        const items = InvocationOptions.items;
        for (let i = 0; i < items.length; ++i) {
            const option = +items[i];
            if (this.isSpecified(option) && !semantics.isSpecified(option)) {
                semantics.setOption(option, this.getOption(option));
            }
        }
    }
});

/**
 * Invokes a method on a target.
 * @class HandleMethod
 * @constructor
 * @param  {number}              methodType  -  get, set or invoke
 * @param  {Protocol}            protocol    -  initiating protocol
 * @param  {string}              methodName  -  method name
 * @param  {Array}               [...args]   -  method arguments
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
             * During invocation, the receiver will have access to a global **$composer** property
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
                const oldComposer = $composer;                    
                try {
                    $composer = composer;
                    switch (methodType) {
                    case MethodType.Get:
                        result = target[methodName];
                        break;
                    case MethodType.Set:
                        result = target[methodName] = args;
                        break;
                    case MethodType.Invoke:
                        result = method.apply(target, args);
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
                } finally {
                    $composer = oldComposer;
                }
            },
            isAcceptableTarget(target) {
                if (!target) { return false; }
                if (!protocol) { return true; }
                return semantics.getOption(InvocationOptions.Strict)
                     ? protocol.isToplevel(target)
                     : semantics.getOption(InvocationOptions.Duck)
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
                return this.invokeOn(handler.delegate, composer) || this.invokeOn(handler, composer);
            }
        });
    }
});

/**
 * Invokes a method using resolution to determine the targets.
 * @class ResolveMethod
 * @constructor
 * @param  {any}            key           -  resolution key
 * @param  {boolean}        many          -  resolution cardinality
 * @param  {HandleMethod}   handleMethod  -  method callback
 * @param  {boolean}        bestEffort    -  true if best effort
 * @extends Resolution
 */
export const ResolveMethod = Resolution.extend({
    constructor(key, many, handleMethod, bestEffort) {
        let _handled;
        this.base(key, many);
        this.extend({
            get callbackResult() {
                const result = this.base();
                if ($isPromise(result)) {
                    return result.then(r => _handled || bestEffort
                         ? handleMethod.callbackResult
                         : Promise.reject(handleMethod.notHandledError()));
                }
                if (_handled || bestEffort) {
                    return handleMethod.callbackResult;                    
                }
                throw handleMethod.notHandledError();
            },
            isSatisfied(resolution, composer) {
                const handled = handleMethod.invokeOn(resolution, composer);
                _handled = _handled || handled;
                return handled;
            }            
        });
    }
});

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
        options   = InvocationOptions.None,
        semantics = new InvocationSemantics();
    handler.handle(semantics, true);

    if (!semantics.isSpecified(InvocationOptions.Duck)
        && DuckTyping.isAdoptedBy(protocol))
        options |= InvocationOptions.Duck;
    
    if (!semantics.isSpecified(InvocationOptions.Strict)
        && StrictProtocol.isAdoptedBy(protocol))
        options |= InvocationOptions.Strict;

    if (options != InvocationOptions.None)
    {
        semantics.setOption(options, true);
        handler = handler.$callOptions(options);
    }

    const broadcast    = semantics.getOption(InvocationOptions.Broadcast),
          bestEffort   = semantics.getOption(InvocationOptions.BestEffort),
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
    toDelegate() { return new InvocationDelegate(this); },
    /**
     * Establishes duck invocation semantics.
     * @method $duck
     * @returns {Handler} duck semantics.
     * @for Handler
     */
    $duck() { return this.$callOptions(InvocationOptions.Duck); },
    /**
     * Establishes strict invocation semantics.
     * @method $strict
     * @returns {Handler} strict semantics.
     * @for Handler
     */
    $strict() { return this.$callOptions(InvocationOptions.Strict); },  
    /**
     * Establishes broadcast invocation semantics.
     * @method $broadcast
     * @returns {Handler} broadcast semanics.
     * @for Handler
     */        
    $broadcast() { return this.$callOptions(InvocationOptions.Broadcast); },
    /**
     * Establishes best-effort invocation semantics.
     * @method $bestEffort
     * @returns {Handler} best-effort semanics.
     * @for Handler
     */                
    $bestEffort() { return this.$callOptions(InvocationOptions.BestEffort); },
    /**
     * Establishes notification invocation semantics.
     * @method $notify
     * @returns {InvocationOptionsHandler} notification semanics.
     * @for Handler
     */
    $notify() { return this.$callOptions(InvocationOptions.Notify); },
    /**
     * Establishes custom invocation semantics.
     * @method $callOptions
     * @param  {InvocationOptions}  options  -  invocation semantics
     * @returns {Handler} custom invocation semanics.
     * @for Handler
     */                        
    $callOptions(options) {
        const semantics = new InvocationSemantics(options);
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                let handled = false;
                if (Composition.isComposed(callback, InvocationSemantics)) {
                    return false;
                }
                if (callback instanceof InvocationSemantics) {
                    semantics.mergeInto(callback);
                    handled = true;
                } else if (!greedy) {
                    if (semantics.isSpecified(InvocationOptions.Broadcast)) {
                        greedy = semantics.getOption(InvocationOptions.Broadcast);
                    } else {
                        const inv = new InvocationSemantics();
                        if (this.handle(inv, true) &&
                            inv.isSpecified(InvocationOptions.Broadcast)) {
                            greedy = inv.getOption(InvocationOptions.Broadcast);
                        }
                    }
                }
                if (greedy || !handled) {
                    handled = this.base(callback, greedy, composer) || handled;
                }
                return !!handled;
            }
        });
    }  
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
