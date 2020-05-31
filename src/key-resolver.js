import { 
    Base, TypeFlags, $isNothing,
    $isPromise, $optional
} from "miruken-core";

import KeyResolving from "./key-resolving";

export const KeyResolver = new (Base.extend(KeyResolving, {
    resolveKey(inquiry, typeInfo, handler) {
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
}));

function resolveKeyInfer(inquiry, typeInfo, handler) {
    if (inquiry.isMany) {
        return handler.resolveAll(inquiry);
    } else {
        const optional = typeInfo.flags.hasFlag(TypeFlags.Optional),
              value    = handler.resolve(inquiry);
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
