import { $isPromise } from "miruken-core";
import Resolution from "./resolution";

/**
 * Invokes a method using resolution to determine the targets.
 * @class ResolveMethod
 * @constructor
 * @param  {any}            key           -  resolution key
 * @param  {boolean}        many          -  resolution cardinality
 * @param  {HandleMethod}   handleMethod  -  method callback
 * @param  {boolean}        bestEffort    -  true if best effort
 * @extends Resolution
 */
export const ResolveMethod = Resolution.extend({
    constructor(key, many, handleMethod, bestEffort) {
        this.base(key, many);
        this._handleMethod = handleMethod;
        this._bestEffort   = bestEffort;
    },

    get callbackResult() {
        const result       = this.base(),
              handleMethod = this._handleMethod;
        if ($isPromise(result)) {
            return result.then(r => this._handled || this._bestEffort
                 ? handleMethod.callbackResult
                 : Promise.reject(handleMethod.notHandledError()));
        }
        if (this._handled || this._bestEffort) {
            return handleMethod.callbackResult;                    
        }
        throw notHandledError();
    },
    isSatisfied(resolution, composer) {
        const handled = this._handleMethod.invokeOn(resolution, composer);
        this._handled = this._handled || handled;
        return handled;
    }    
});

export default ResolveMethod;