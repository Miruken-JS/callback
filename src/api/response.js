import { 
    Base, decorate, $isNothing, $isFunction
} from "miruken-core";

const ResponseTypeResolver = Symbol("response-type");

export class ResponseWrapper extends Base {
    constructor(response) {
        if (new.target === ResponseWrapper) {
            throw new TypeError("ResponseWrapper cannot be instantiated.");
        }
        super();
        this.response = response;
    }

    response;
}

export function response(...args) {
    return decorate((target, key, descriptor, args) => {
        if ($isNothing(descriptor)) {
            let [responseType] = args;
            if ($isNothing(responseType)) {
                throw new Error("The responseType argument is required.");
            }
            if (!$isFunction(responseType)) {
                throw new Error("The responseType argument is not a class.");
            }            
            function getter() { return responseType; }
            Object.defineProperty(target, ResponseTypeResolver, {
                configurable: false,
                enumerable:   false,
                value:        getter
            });
            Object.defineProperty(target.prototype, ResponseTypeResolver, {
                configurable: false,
                enumerable:   false,
                value:        getter
            });
        } else {
            let getter;
            const { get, value } = descriptor;
            if ($isFunction(get)) {
                getter = get;
                ignore(target, key, descriptor);
            } else if ($isFunction(value)) {
                getter = value;
            } else {
                throw new SyntaxError("@response can only be applied to classes, getters or methods.");
            } 
            Object.defineProperty(target, ResponseTypeResolver, {
                configurable: false,
                enumerable:   false,
                value:        function () { 
                    const id = getter.call(this);
                    if (!$isString(id)) {
                        throw new Error(`@response getter '${key}' returned invalid identifier ${id}.`);
                    }
                    return id;
                }
            });
        }
    }, args);
}

response.get = function (target) {
    return target?.[ResponseTypeResolver]?.();;
}
