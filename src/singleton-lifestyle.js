import { 
    $isNothing, $isPromise, createKey
} from "miruken-core";

import { 
    Lifestyle, LifestyleProvider
} from "./lifestyle";

import { createFilterDecorator } from "./filters/filter";

const _ = createKey();

export class SingletonLifestyle extends Lifestyle {
    getInstance(inquiry, { next }) {
        let instance = _(this).instance;
        if ($isNothing(instance)) {
            instance = _(this).instance = next();
            if ($isPromise(instance)) {
                instance
                .then(result => _(this).instance = result)
                .catch(() => _(this).instance = null);
            }
        }
        return instance;
    }
}

export class SingletonLifestyleProvider extends LifestyleProvider {
    constructor() {
        super();
        _(this).lifestyle = [new SingletonLifestyle()];
    }

    getFilters(binding, callback, composer) {
        return _(this).lifestyle;
    }
}

export const singleton = createFilterDecorator(
    () => new SingletonLifestyleProvider())();

export default singleton;
