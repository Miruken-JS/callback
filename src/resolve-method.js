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
        let _handled;
        this.base(key, many);
        this.extend({
            get callbackResult() {
                const result = this.base();
                if ($isPromise(result)) {
                    return result.then(r => _handled || bestEffort
                         ? handleMethod.callbackResult
                         : Promise.reject(handleMethod.notHandledError()));
                }
                if (_handled || bestEffort) {
                    return handleMethod.callbackResult;                    
                }
                throw handleMethod.notHandledError();
            },
            isSatisfied(resolution, composer) {
                const handled = handleMethod.invokeOn(resolution, composer);
                _handled = _handled || handled;
                return handled;
            }            
        });
    }
});

export default ResolveMethod;