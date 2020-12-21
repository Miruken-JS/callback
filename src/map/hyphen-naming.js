import { conformsTo, $isNothing } from "miruken-core";
import { Mapping } from "./mapping";

export const hyphenNaming = Base => 
    @conformsTo(Mapping) class extends Base {
    getPropertyName(target, key) {
        if (!$isNothing(key)) {
            return key.split(/(?=[A-Z])/).join('-').toLowerCase();
        }
    }
};
