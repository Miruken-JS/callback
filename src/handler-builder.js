import { 
    $isNothing, $isSomething, $isFunction,
    $isProtocol, createKey
} from "miruken-core";

import { CompositeHandler } from "./composite-handler";
import { InferenceHandler } from "./inference-handler";
import { unmanaged } from "./unmanaged";

const _ = createKey();

export class SourceProvider {
    constructor() {
        _(this).providers = []; 
    }

    getTypes() {
        const types = _(this).providers.flatMap(provider => provider());
        return [...new Set(types)];
    }

    fromModules(...modules) {
        const providers = _(this).providers;
        modules.flat().forEach(module => {
            if ($isSomething(module)) {
                providers.push(() => Object.keys(module)
                    .map(key => module[key])
                    .filter(managedType));
            }
        });
        return this;
    }

    fromTypes(...types) {
        const validTypes = types.flat().filter(requiredType);
        if (validTypes.length > 0) {
            _(this).providers.push(() => validTypes);
        }
        return this;
    }
}

export class DecoratorProvider {
    constructor() {
        _(this).decorators = []; 
    }
    
    get decorators() { return _(this).decorators; }

    withDecorators(...decorators) {
        const set = _(this).decorators;
        decorators.flat().filter($isSomething)
            .forEach(decorator => set.add(decorator));
        return this;
    }    
}

export class TypeSelector {
    constructor() {
        _(this).decorators = new DecoratorProvider();
    }

    get decorators() { 
        return _(this).decorators;
    }

    acceptType(type) {
        return _(this).filter?.(type) === true;
    }

    assignableTo(constraints) {
        _(this).filters = type => constraints.flat()
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
        return _(this).decorators;
    }

    where(predicate) {
        _(this).filter = predicate;
        return _(this).decorators;
    }
}

export class HandlerBuilder {
    constructor() {
        _(this).sources    = new SourceProvider();
        _(this).selectors  = [];
        _(this).decorators = new Set();
    }

    addSources(addSources) {
        if ($isNothing(addSources)) {
            throw new Error("The addSources is required.");
        }

        if (!$isFunction(addSources)) {
            throw new Error("The addSources is expected to be a function.");
        }

        addSources(_(this).sources);
        return this;
    }

    selectTypes(selectTypes) {
        if ($isNothing(selectTypes)) {
            throw new Error("The selectTypes is required.");
        }

        if (!$isFunction(selectTypes)) {
            throw new Error("The selectTypes is expected to be a function.");
        }

        const selector = new TypeSelector();
        selectTypes(selector);
        _(this).selectors.push(selector);
        return this;
    }
    
    withDecorators(...decorators) {
        const set = _(this).decorators;
        decorators.flat().filter($isSomething)
            .forEach(decorator => set.add(decorator));
    }

    build() {
        const handler   = new CompositeHandler(),
              selectors = _(this).selectors,
              types     = _(this).sources.getTypes()
                .filter(type => {
                    if (selectors.length == 0) return true;
                    const match = selectors.find(
                        selector => selector.acceptType(type));
                    if ($isSomething(match)) {
                        return true;
                    }
                    return false;
                });
              
        handler.addHandlers(new InferenceHandler(types));
        return handler;
    }
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