import { 
    $isNothing, $isNumber, createKey 
} from "miruken-core";

const _ = createKey();

export class FilterSpec {
    constructor(filterType, { required, order } = {}) {
        if ($isNothing(filterType)) {
            throw new Error("FilterSpec requires a filterType.")
        }
        if (!$isNothing(order) && !$isNumber(order)) {
            throw new TypeError("The order must be a number.")
        }
        const _this = _(this);
        _this.filterType = filterType;
        _this.required   = required === true;
        _this.order      = order;
    }

    get filterType() { return _(this).filterType; }
    get required() { return _(this).required; }
    get order() { return _(this).order; }
}

