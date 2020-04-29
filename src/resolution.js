import {
    Base, Undefined, Variance,
    $isPromise, $classOf,$isNothing,
    $instant, $flatten
} from "miruken-core";

import { Binding, $provide } from "./policy";
import { DispatchingCallback, $unhandled } from "./callback";

/**
 * Callback representing the covariant resolution of a key.
 * @class Resolution
 * @constructor
 * @param   {any}      key   -  resolution key
 * @param   {boolean}  many  -  resolution cardinality
 * @extends Base
 */
export const Resolution = Base.extend(DispatchingCallback, {
    constructor(key, many) {
        if ($isNothing(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        let _resolutions = [],
            _promised    = false, _result,
            _instant     = $instant.test(key);
        this.extend({
            /**
             * Gets the key.
             * @property {Any} key
             * @readOnly
             */                
            get key() { return key; },
            /**
             * true if resolve all, false otherwise.
             * @property {boolean} isMany
             * @readOnly
             */                
            get isMany() { return many; },
            /**
             * true if resolve all is instant.  Otherwise a promise.
             * @property {boolean} instant
             * @readOnly
             */
            get instant() { return !_promised; },
            /**
             * Gets the resolutions.
             * @property {Array} resolutions
             * @readOnly
             */                
            get resolutions() { return _resolutions; },
            /**
             * Gets the policy.
             * @property {Function} policy
             * @readOnly
             */         
            get policy() { return $provide; },            
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */
            get callbackResult() {
                if (_result === undefined) {
                    if (!many) {
                        const resolutions = $flatten(_resolutions, true);
                        if (resolutions.length > 0) {
                            _result = resolutions[0];
                        }
                    } else {
                        _result = !_promised
                            ? $flatten(_resolutions, true)
                            : Promise.all(_resolutions).then(res => $flatten(res, true));
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Adds a resolution.
             * @param  {Any}      resolution  -  resolution
             * @param  {Handler}  composer    -  composition handler
             * @returns {boolean} true if accepted, false otherwise.
             */
            resolve(resolution, composer) {
                if (!many && _resolutions.length > 0) {
                    return false;
                }
                if ($isPromise(resolution)) {
                    if (_instant) { return false; }
                    _promised = true;
                    resolution = resolution.then(r => {
                        if (this.isSatisfied(r, composer)) { return r; }
                    });
                    if (many) {
                        resolution = resolution.catch(Undefined);
                    }
                } else if (!this.isSatisfied(resolution, composer)) {
                    return false;
                }
                _resolutions.push(resolution);
                _result = undefined;
                return true;
            },
            /**
             * Determines if `resolution` is acceptable.
             * @param  {Any}      resolution  -  resolution
             * @param  {Handler}  composer    -  composition handler
             * @returns {boolean} true if accepted, false otherwise.
             */            
            isSatisfied(resolution, composer) {
                return true;
            },
            dispatch(handler, greedy, composer) {
                const key      = this.key,
                      many     = this.isMany;
                let   resolved = $provide.dispatch(
                    handler, this, key, composer, many, this.resolve);
                if (resolved === $unhandled) {
                    // check if handler implicitly satisfies key
                    const implied  = new Binding(key);
                    if (implied.match($classOf(handler), Variance.Contravariant)) {
                        resolved = this.resolve(handler, composer);
                        if (resolved ) return true;
                    }
                }
                return resolved !== $unhandled;
            }
        });
    }
});

export default Resolution;