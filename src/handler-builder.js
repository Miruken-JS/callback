import { 
    design, $isNothing, $isSomething,
    $isFunction, $isProtocol, createKey
} from "miruken-core";

import { Handler } from "./handler";
import { CompositeHandler } from "./composite-handler";
import { InferenceHandler } from "./inference-handler";
import { Filtering } from "./filters/filtering";
import { provides } from "./callback-policy";
import { singleton } from "./singleton-lifestyle";
import { unmanaged } from "./unmanaged";

const _ = createKey(),
          defaultDecorators = [singleton];

export class SourceBuilder {
    constructor() {
        _(this).sources = []; 
    }

    getTypes() {
        const types = _(this).sources.flatMap(getTypes => getTypes());
        return [...new Set(types)];
    }

    fromModules(...modules) {
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

    fromTypes(...types) {
        const managedTypes = types.flat().filter(requiredType);
        if (managedTypes.length > 0) {
            _(this).sources.push(() => managedTypes);
        }
        return this;
    }
}

export class ProvidesBuilder {
    get implicit() {
        return _(this).implicit;
    }

    get decorators() {
        return _(this).decorators;
    }

    provideImplicitly(...decorators) {
        _(this).implicit   = true
        _(this).decorators = decorators.flat().filter($isSomething); 
    }

    provideExplicitly() {
        _(this).implicit = false;
        delete _(this).decorators;
    }
}

export class TypeSelector {
    constructor() {
        _(this).provides = new ProvidesBuilder();
    }

    get provides() { 
        return _(this).provides;
    }

    acceptType(type) {
        return _(this).filter?.(type) === true;
    }

    assignableTo(constraints) {
        _(this).filter = type => constraints.flat()
            .filter($isSomething)
            .some(constraint => {
                if ($isProtocol(constraint)) {
                    return constraint.isAdoptedBy(type);
                }
                if ($isFunction(constraint)) {
                    return type.prototype instanceof constraint;
                }
                return false;
            });
        return this.provides;
    }

    where(predicate) {
        if ($isNothing(predicate)) {
            throw new Error("The predicate argument is required.");
        }
        _(this).filter = predicate;
        return this.provides;
    }
}

export class HandlerBuilder {
    constructor() {
        const _this = _(this);
        _this.sources           = new SourceBuilder();
        _this.selectors         = [];
        _this.handlers          = [];
        _this.provideImplicitly = true;

        this.selectTypes(types => types.where(isStandardType));
    }

    addSources(addSources) {
        if ($isNothing(addSources)) {
            throw new Error("The addSources argument is required.");
        }

        if (!$isFunction(addSources)) {
            throw new Error("The addSources argument is not a function.");
        }

        addSources(_(this).sources);
        return this;
    }

    selectTypes(selectTypes) {
        if ($isNothing(selectTypes)) {
            throw new Error("The selectTypes argument is required.");
        }

        if (!$isFunction(selectTypes)) {
            throw new Error("The selectTypes argument is not a function.");
        }

        const selector = new TypeSelector();
        selectTypes(selector);
        _(this).selectors.push(selector);
        return this;
    }
    
    addHandlers(...handlers) {
        _(this).handlers.push(...handlers.flat().filter($isSomething));
        return this;
    }

    provideImplicitly(...decorators) {
        _(this).provideImplicitly = true;
        _(this).implicitDecorators = decorators.flat().filter($isSomething);
        return this;
    }

    provideExplicitly() {
        _(this).provideImplicitly = false;
        delete _(this).implicitDecorators;
        return this;
    }

    build() {
        const selectors  = _(this).selectors,
              types      = _(this).sources.getTypes().flatMap(type => {
            const match = selectors.find(
                selector => selector.acceptType(type));
            if ($isSomething(match)) {
                if (!provides.isDefined(type)) {
                    const provideOptions = match.provides;
                    let provideImplicitly = _(this).provideImplicitly;
                    if ($isSomething(provideOptions.implicit)) {
                        provideImplicitly = provideOptions.implicit;
                    }
                    if (provideImplicitly) {
                        const decorators = match.decorators 
                                        || _(this).implicitDecorators
                                        || defaultDecorators;
                        return [createFactory(type, decorators)];
                    }
                } else {
                    return [type];
                }
            }
            return [];
        });
              
        return new CompositeHandler()
            .addHandlers(_(this).handlers)
            .addHandlers(new InferenceHandler(types));
    }
}

function createFactory(type, decorators) {
    class Factory {
        @provides(type) static create(...args) {
            return Reflect.construct(type, args);
        }
    }
    const signature = design.get(type, "constructor");
    if ($isSomething(signature)) {
        design.getOrCreateOwn(Factory, "create", () => signature);
    }
    Reflect.decorate(decorators, Factory, "create",
        Reflect.getOwnPropertyDescriptor(Factory, "create"));
    return Factory;
}

function isStandardType(type) {
    return type.prototype instanceof Handler ||
           Filtering.isAdoptedBy(type) ||
           type.name.endsWith("Handler");
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