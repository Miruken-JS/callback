import { Enum, $isFunction } from "miruken-core";

export const HandleResult = Enum(HandleResult => ({
    Handled:           HandleResult(true,  false),
    HandledAndStop:    HandleResult(true,  true),    
    NotHandled:        HandleResult(false, false),
    NotHandledAndStop: HandleResult(false, true)
}), {
    constructor(handled, stop) {
        this.extend({
            get handled() { return handled; },
            get stop()    { return stop; }
        });
    },

    next(condition, block) {
        let stop = this.stop;
        if (block == null) {
            block = condition;
        } else {
            stop = stop || !condition;
        }
        return stop || !$isFunction(block)
             ? this
             : mapResult(block, this);
    },

    success(block) {
        if (this.handled && $isFunction(block)) {
            return block.call(this);
        }
    },

    failure(block) {
        if (!this.handled && $isFunction(block)) {
            return block.call(this);
        }
    },

    otherwise(condition, block) {
        if ($isFunction(block)) {
           return ((this.handled || this.stop) && !condition)
                ? this
                : mapResult(block, this);
        } else if ($isFunction(condition)) {
            return this.handled || this.stop
                 ? this
                 : mapResult(condition, this);
        } else if (condition || this.handled) {
            return this.stop
                 ? HandleResult.HandledAndStop 
                 : HandleResult.Handled;
        } else {
            return this.stop
                 ? HandleResult.NotHandledAndStop 
                 : HandleResult.NotHandled;
        }
    },

    or(other) {
        if (!(other instanceof HandleResult)) {
            return this;
        } else if (this.handled || other.handled) {
            return this.stop || other.stop
                 ? HandleResult.HandledAndStop
                 : HandleResult.Handled;
        } else {
            return this.stop || other.stop
                 ? HandleResult.NotHandledAndStop
                 : HandleResult.NotHandled;            
        }
    },

    and(other) {
        if (!(other instanceof HandleResult)) {
            return this;
        } else if (this.handled && other.handled) {
            return this.stop || other.stop
                 ? HandleResult.HandledAndStop
                 : HandleResult.Handled;
        } else {
            return this.stop || other.stop
                 ? HandleResult.NotHandledAndStop
                 : HandleResult.NotHandled;            
        }
    },

    toString() {
        return `HandleResult | ${this.handled ? "handled" : "not handled"} ${this.stop ? " and stop" : ""}`;
    }
});

function mapResult(block, handleResult) {
    const result = block.call(handleResult);
    return result instanceof HandleResult ? result
         : (result ? HandleResult.Handled : HandleResult.NotHandled);
}

export default HandleResult;
