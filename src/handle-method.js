import {
    Base, MethodType, TypeFlags, conformsTo,
    design, $isNothing, $isFunction, $isProtocol,
    $isPromise, $optional, $contents,
    createKeyChain
} from "miruken-core";

import { Trampoline } from "./trampoline";
import { Resolving } from "./resolving";
import { Inquiry } from "./inquiry";
import { KeyResolver } from "./key-resolver";
import { filter } from "./filter/filter";
import { FilteredScope } from "./filter/filtered-scope";
import { CallbackControl } from "./callback-control";
import { HandlerDescriptor } from "./handler-descriptor";
import { CallbackOptions, CallbackSemantics } from "./callback-semantics"
import { Binding } from "./binding/binding";
import { $unhandled } from "./callback-policy";
import { NotHandledError } from "./errors";

const _ = createKeyChain(),
      defaultKeyResolver = new KeyResolver(),
      globalFilters      = new FilteredScope();

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
@conformsTo(CallbackControl)
export class HandleMethod extends Base {
    constructor(methodType, protocol, methodName, args, semantics) {
        if ($isNothing(methodName)) {
            throw new Error("The methodName argument is required");
        }
        if (protocol && !$isProtocol(protocol)) {
            throw new TypeError("Invalid protocol supplied.");
        }
        super();
        const _this = _(this);
        _this.methodType = methodType;
        _this.protocol   = protocol;
        _this.methodName = methodName;
        _this.args       = args;
        _this.semantics  = semantics || new CallbackSemantics();
    }

    get methodType()          { return _(this).methodType; }
    get protocol()            { return _(this).protocol; }
    get semantics()           { return _(this).semantics; }
    get methodName()          { return _(this).methodName; }
    get args()                { return _(this).args; }
    set args(value)           { _(this).args = value; }
    get returnValue()         { return _(this).returnValue; }
    set returnValue(value)    { _(this).returnValue = value; }
    get exception()           { return _(this).exception; }
    set exception(exception)  { _(this).exception = exception; }        
    get callbackResult()      { return _(this).returnValue; }
    set callbackResult(value) { _(this).returnValue = value; }

    inferCallback() {
        return new HandleMethodInference(this);
    }

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
        
        let method;
        const { methodName, methodType, args } = this;

        if (methodType === MethodType.Invoke) {
            method = target[methodName];
            if (!$isFunction(method)) return false;
        }

        let filters, binding;

        if (!$isNothing(composer)) {
            const owner = HandlerDescriptor.get(target, true);
            binding = Binding.create(HandleMethod, target, null, methodName);
            filters = composer.$getOrderedFilters(binding, this, [
                binding.getMetadata(filter), owner, HandleMethod.globalFilters
            ]);
            if ($isNothing(filters)) return false;   
        }

        let action, completed = true;

        try {
            switch (methodType) {
            case MethodType.Get:
                action = composer != null
                       ? () => composer.$compose(() => target[methodName])
                       : () => target[methodName];
                break;
            case MethodType.Set:
                action = composer != null
                       ? () => composer.$compose(() => target[methodName] = args)
                       : () => target[methodName] = args;
                break;
            case MethodType.Invoke:
                action = composer != null
                       ? () => composer.$compose(() => method.apply(target, args))
                       : () => method.apply(target, args);
                break;
            }

            const result = $isNothing(filters) || filters.length == 0
                ? action()
                : filters.reduceRight((next, pipeline) => (comp, proceed) => {
                    if (proceed) {
                        const filter    = pipeline.filter,
                              signature = design.get(filter, "next"),
                              args      = resolveArgs.call(this, signature, comp);
                        if (!$isNothing(args)) {
                            const provider = pipeline.provider, context  = {
                                binding, rawCallback: this, provider, composer: comp,
                                next: (c, p) => next(
                                    c != null ? c : comp, 
                                    p != null ? p : true),
                                abort: () => next(null, false)
                            };
                            return $isPromise(args)
                                 ? args.then(a => filter.next(...a, context))
                                 : filter.next(...args, context);
                        }
                    }
                    completed = false;
                }, (comp, proceed) => {
                    if (proceed) return action();
                    completed = false;
                })(composer, true);

            if (!completed || result === $unhandled) {
                return false;
            }

            _(this).returnValue = result;
            return true;                        
        } catch (exception) {
            _(this).exception = exception;
            throw exception;
        }
    }

    isAcceptableTarget(target) {
        if ($isNothing(target)) return false;
        if ($isNothing(this.protocol)) return true;
        return this.semantics.hasOption(CallbackOptions.Strict)
             ? this.protocol.isToplevel(target)
             : this.semantics.hasOption(CallbackOptions.Duck)
            || this.protocol.isAdoptedBy(target);
    }

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
    }

    dispatch(handler, greedy, composer) {
        return this.invokeOn(handler, composer);
    }    

    toString() {
        return `HandleMethod | ${this.methodName}`;
    }

    static get globalFilters() { return globalFilters; }
}

class HandleMethodInference extends Trampoline {
    constructor(handleMethod) {
        super(handleMethod);
        _(this).resolving = new Resolving(handleMethod.protocol, handleMethod);
    }

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
    }
    set callbackResult(value) { super.callbackResult = value; }
    
    dispatch(handler, greedy, composer) {
        return super.dispatch(handler, greedy, composer) ||
               _(this).resolving.dispatch(handler, greedy, composer);          
    }
}

function resolveArgs(signature, composer) {
    if ($isNothing(signature)) {
        return [this];
    }
    const { args } = signature;
    if ($isNothing(args) || args.length === 0) {
        return [this];
    }

    const resolved = [], promises = [];

    for (let i = 0; i < args.length; ++i) {     
        const arg = args[i];
        if ($isNothing(arg)) {
            if (i === 0) {
                resolved[0] = this;
            }
            continue;
        }

        if (i === 0 && $isNothing(arg.keyResolver)) {
            if (arg.validate(this)) {
                resolved[0] = this;
                continue;
            }
        }

        const resolver = arg.keyResolver || defaultKeyResolver,
              validate = resolver.validate;

        if ($isFunction(validate)) {
            validate.call(resolver, arg);
        }
        
        const dep = resolver.resolve(arg, composer);
        if ($isNothing(dep)) return null;
        if ($optional.test(dep)) {
            resolved[i] = $contents(dep);
        } else if ($isPromise(dep)) {
            promises.push(dep.then(result => resolved[i] = result));
        } else {
            resolved[i] = dep;
        }
    }

    if (promises.length === 0) {
        return resolved;
    }
    if (promises.length === 1) {
        return promises[0].then(() => resolved);
    }
    return Promise.all(promises).then(() => resolved);
}