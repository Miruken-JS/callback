import { 
    $isNothing, $isSomething, $isFunction,
    $isProtocol, createKey
} from "miruken-core";

import { Handler } from "./handler";
import { CompositeHandler } from "./composite-handler";
import { InferenceHandler } from "./inference-handler";
import { Filtering } from "./filters/filtering";
import { unmanaged } from "./unmanaged";

const _ = createKey();

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

export class DecoratorBuilder {
    constructor() {
        _(this).decorators = new Set(); 
    }
    
    get decorators() {
        return [..._(this).decorators];
    }

    withDecorators(...decorators) {
        const set = _(this).decorators;
        decorators.flat().filter($isSomething)
            .forEach(decorator => set.add(decorator));
        return this;
    }    
}

export class TypeSelector {
    constructor() {
        _(this).decorators = new DecoratorBuilder();
    }

    get decorators() { 
        return _(this).decorators.decorators;
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
        return _(this).decorators;
    }

    where(predicate) {
        if ($isNothing(predicate)) {
            throw new Error("The predicate argument is required.");
        }
        _(this).filter = predicate;
        return _(this).decorators;
    }
}

export class HandlerBuilder {
    constructor() {
        _(this).sources    = new SourceBuilder();
        _(this).selectors  = [];
        _(this).decorators = new Set();
        _(this).handlers   = [];

        this.selectTypes(types => types.where(isDefaultType));
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

    withDecorators(...decorators) {
        const set = _(this).decorators;
        decorators.flat().filter($isSomething)
            .forEach(decorator => set.add(decorator));
        return this;
    }

    build() {
        const selectors  = _(this).selectors,
              decorators = [..._(this).decorators],
              types      = _(this).sources.getTypes()
                  .filter(type => {
                      const match = selectors.find(
                          selector => selector.acceptType(type));
                      if ($isSomething(match)) {
                          Reflect.decorate(match.decorators, type);
                          Reflect.decorate(decorators, type);
                          return true;
                      }
                      return false;
                  });
              
        return new CompositeHandler()
            .addHandlers(_(this).handlers)
            .addHandlers(new InferenceHandler(types));
    }
}

function isDefaultType(type) {
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