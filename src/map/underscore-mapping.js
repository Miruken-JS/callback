import { conformsTo, $isNothing } from "miruken-core";
import { Mapping } from "./mapping";

conformsTo(Mapping)
export class UnderscoreMapping {
    getPropertyName(target, key) {
        if ($isNothing(key)) return;
        return key.split(/(?=[A-Z])/).join('_').toLowerCase();
    }
}