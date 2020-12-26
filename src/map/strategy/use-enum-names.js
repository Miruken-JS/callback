import { 
    Enum, conformsTo, $isNothing, $isFunction
} from "miruken-core";

import { Mapping } from "../mapping";

export function useEnumNames(...enumTypes) {
    enumTypes = validateEnumTypes(enumTypes);
    return Base => @conformsTo(Mapping) class extends Base {
        shouldUseEnumName(enumType, target, key) {
            if ($isNothing(enumTypes) || enumTypes.length === 0 ||
                enumTypes.includes(enumType)) {
                return true;
            }
            const chain = Base.prototype.shouldUseEnumName;
            return $isFunction(chain)
                 ? chain.call(this, enumType, target, key)
                 : false;
        };
    }
}

function validateEnumTypes(enumTypes) {
    return enumTypes.flat().filter(enumType => {
        if ($isNothing(enumType)) return false;
        if (!(enumType.prototype instanceof Enum)) {
            throw new TypeError(`${String(enumType)} is not an Enum type.`);
        }
        return true;
    });
}
