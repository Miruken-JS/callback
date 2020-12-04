import { 
    Base, design, $isNothing, $isSomething,
    $isFunction, $isProtocol, createKey
} from "miruken-core";

import { Handler } from "./handler";
import { CompositeHandler } from "./composite-handler";
import { InferenceHandler } from "./inference-handler";
import { HandlerDescriptor } from "./handler-descriptor";
import { Filtering } from "./filter/filtering";
import { provides } from "./callback-policy";
import { singleton } from "./singleton-lifestyle";
import { unmanaged } from "./unmanaged";

import { ErrorHandler } from "./handler-errors";
import { CachedHandler } from "./api/cache/cached-handler";
import { Scheduler } from "./api/schedule/scheduler";

const _ = createKey(),
      defaultDecorators = [singleton];

export class SourceBuilder extends Base {
    constructor() {
        super();
        _(this).sources = [];
        this.types(ErrorHandler, CachedHandler, Scheduler);
    }

    getTypes() {
        const types = _(this).sources.flatMap(getTypes => getTypes());
        return [...new Set(types)];
    }

    modules(...modules) {
        const sources = _(this).sources;
        modules.flat().forEach(module => {
            if ($isSomething(module)) {
                sources.push(() => Object.keys(module)
                    .map(key => module[key])
                    .filter(managedType));
            }
        });
        return this;
    }

    types(...types) {
        const managedTypes = types.flat().filter(requiredType);
        if (managedTypes.length > 0) {
            _(this).sources.push(() => managedTypes);
        }
        return this;
    }
}

export class ProvideBuilder extends Base {
    constructor(owner) {
        super();
        _(this).owner = owner;
    }

    implicitConstructors(...decorators) {
        _(this).owner.implicitConstructors = true
        _(this).owner.implicitDecorators = decorators.flat().filter($isSomething); 
    }

    explicitConstructors() {
        _(this).owner.implicitConstructors = false;
        delete _(this).owner.implicitDecorators;
    }
}

export class DeriveTypesBuilder extends Base {
    constructor(owner) {
        super();
        _(this).owner = owner;
    }

    deriveTypes(deriveTypes) {
        if ($isNothing(deriveTypes)) {
            throw new Error("The deriveTypes argument is required.");
        }
        if (!$isFunction(deriveTypes)) {
            throw new TypeError("The deriveTypes argument must be a function.");
        }        
        _(this).owner.deriveTypes = deriveTypes;
    }
}

class TypeDetailsBuilder extends Base {
    constructor(owner) {
        super();
        _(this).owner = owner;
    }

    implicitConstructors(...decorators) {
        new ProvideBuilder(_(this).owner).implicitConstructors(...decorators);
        return new DeriveTypesBuilder(_(this).owner);
    }

    explicitConstructors() {
        new ProvideBuilder(_(this).owner).explicitConstructors();
        return new DeriveTypesBuilder(_(this).owner);
    }

    deriveTypes(deriveTypes) {
        new DeriveTypesBuilder(_(this).owner).deriveTypes(deriveTypes);
        return new ProvideBuilder(_(this).owner);
    }
}

export class SelectTypesBuilder extends Base {
    get implicitConstructors() {
        return _(this).implicitConstructors;
    }

    get implicitDecorators() {
        return _(this).implicitDecorators;
     }

    acceptType(type) {
        return _(this).condition?.(type) === true;
    }

    deriveTypes(type) {
        const deriveTypes = _(this).deriveTypes;
        return $isNothing(deriveTypes) ? [type] : deriveTypes(type);
    }

    extendFrom(clazz, includeSelf) {
        if ($isNothing(clazz)) {
            throw new Error("The clazz argument is required.");
        }     
        if (!$isFunction(clazz)) {
            throw new TypeError("The clazz argument is not a class.");
        }   
        _(this).condition = type =>
            type.prototype instanceof clazz ||
            (type === clazz && includeSelf);
        return new TypeDetailsBuilder(_(this));
    }

    conformTo(protocol) {
        if ($isNothing(protocol)) {
            throw new Error("The protocol argument is required.");
        }
        if (!$isProtocol(protocol)) {
            throw new TypeError("The protocol argument is not a Protocol.");
        } 
        _(this).condition = type => protocol.isAdoptedBy(type);
        return new TypeDetailsBuilder(_(this));
    }

    satisfy(predicate) {
        if ($isNothing(predicate)) {
            throw new Error("The predicate argument is required.");
        }
        if (!$isFunction(predicate)) {
            throw new TypeError("The predicate argument must be a function.");
        }
        _(this).condition = predicate;
        return new TypeDetailsBuilder(_(this));
    }
}

export class HandlerBuilder extends Base {
    constructor() {
        super();
        const _this = _(this);
        _this.sources              = new SourceBuilder();
        _this.selectors            = [];
        _this.handlers             = [];
        _this.implicitConstructors = true;

        this.takeTypes(that => that.satisfy(defaultTypes));
    }

    addTypes(from) {
        if ($isNothing(from)) {
            throw new Error("The from argument is required.");
        }

        if (!$isFunction(from)) {
            throw new Error("The from argument is not a function.");
        }

        from(_(this).sources);
        return this;
    }

    takeTypes(that) {
        if ($isNothing(that)) {
            throw new Error("The that argument is required.");
        }

        if (!$isFunction(that)) {
            throw new Error("The that argument is not a function.");
        }

        const selector = new SelectTypesBuilder();
        that(selector);
        _(this).selectors.push(selector);
        return this;
    }
    
    addHandlers(...handlers) {
        _(this).handlers.push(...handlers.flat().filter($isSomething));
        return this;
    }

    implicitConstructors(...decorators) {
        _(this).implicitConstructors = true;
        _(this).implicitDecorators = decorators.flat().filter($isSomething);
        return this;
    }

    explicitConstructors() {
        _(this).implicitConstructors = false;
        delete _(this).implicitDecorators;
        return this;
    }

    build() {
        const selectors  = _(this).selectors,
              types      = _(this).sources.getTypes().flatMap(type => {
            const match = selectors.find(selector => selector.acceptType(type));
            if ($isSomething(match)) {
                return match.deriveTypes(type).flatMap(t => {
                    if (provides.isDefined(t)) return [t]; 
                    let implicitConstructors = _(this).implicitConstructors;
                    if ($isSomething(match.implicitConstructors)) {
                        implicitConstructors = match.implicitConstructors;
                    }
                    if (implicitConstructors) {
                        const signature = design.get(t, "constructor");
                        if (t.length === 0 || $isSomething(signature)) {
                            const decorators = match.implicitDecorators 
                                            || _(this).implicitDecorators
                                            || defaultDecorators;
                            return [t, createFactory(t, signature, decorators)];
                        }
                    }
                    return [];
                });
            }
            return [];
        });
              
        return this.createHandler(types, _(this).handlers);
    }

    createHandler(selectedTypes, explicitHandlers) {
        return new CompositeHandler()
            .addHandlers(explicitHandlers)
            .addHandlers(new InferenceHandler(selectedTypes));
    }
}

function createFactory(type, signature, decorators) {
    class Factory {
        @provides(type) static create(...args) {
            return Reflect.construct(type, args);
        }
    }
    if ($isSomething(signature)) {
        design.getOrCreateOwn(Factory, "create", () => signature);
    }
    Reflect.decorate(decorators, Factory, "create",
        Reflect.getOwnPropertyDescriptor(Factory, "create"));
    return Factory;
}

function defaultTypes(type) {
    const prototype = type.prototype;
    return prototype instanceof Handler || Filtering.isAdoptedBy(type) ||
        $isSomething(HandlerDescriptor.getChain(type).next().value)    ||
        $isSomething(HandlerDescriptor.getChain(prototype).next().value);
}

function managedType(type) {
    if ($isNothing(type) || $isProtocol(type)) {
        return false;
    }
    return $isFunction(type) && !unmanaged.isDefined(type);
}

function requiredType(type) {
    if (!managedType(type)) {
        throw new TypeError(`Invalid type ${type} is not a class.`);
    }
    return true;
}