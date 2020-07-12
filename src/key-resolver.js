import { 
    Base, TypeFlags, conformsTo,
    $isNothing, $isPromise, $optional
} from "miruken-core";

import KeyResolving from "./key-resolving";

@conformsTo(KeyResolving)
export class KeyResolver extends Base {
    resolve(inquiry, typeInfo, handler) {
        if (typeInfo.flags.hasFlag(TypeFlags.Lazy)) {
            return ((created, dep) => () => {
                if (!created) {
                    created = true;
                    dep = resolveKeyInfer.call(this, inquiry, typeInfo, handler);
                }
                return dep;
            })();
        }
        return resolveKeyInfer.call(this, inquiry, typeInfo, handler);
    }

    resolveKey(inquiry, typeInfo, handler) {
        return handler.resolve(inquiry, typeInfo.constraints);
    }

    resolveKeyAll(inquiry, typeInfo, handler) {
        return handler.resolveAll(inquiry, typeInfo.constraints);
    }
}

function resolveKeyInfer(inquiry, typeInfo, handler) {
    if (inquiry.isMany) {
        return this.resolveKeyAll(inquiry, typeInfo, handler);
    } else {
        const optional = typeInfo.flags.hasFlag(TypeFlags.Optional),
              value    = this.resolveKey(inquiry, typeInfo, handler);
        if ($isNothing(value)) {
            return optional ? $optional(value) : value;
        } if ($isPromise(value)) {
            return value.then(result => {
                if ($isNothing(result) && !optional) {
                    throw new Error(`Unable to resolve key '${inquiry.key}'.`);
                }
                return result;
            });
        }
        return value;
    }
}

export default KeyResolver;
