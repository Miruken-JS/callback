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
            _promises    = [],
            _instant     = $instant.test(key),
            _result;
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
            get instant() { return _promises.length == 0; },
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
                    if (this.instant) {
                        _result = many ? _resolutions : _resolutions[0];
                    } else {
                        _result = many 
                                ? Promise.all(_promises).then(() => _resolutions)
                                : Promise.all(_promises).then(() => _resolutions[0]);
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
                let resolved;
                if (resolution == null) return false;
                if (Array.isArray(resolution)) {
                    resolved = $flatten(resolution, true).reduce(
                        (s, r) => this.include(r, composer) || s, false);  
                } else {
                    resolved = this.include(resolution, composer);
                }
                if (resolved) {
                    _result = undefined;
                }
                return resolved;
            },
            include(resolution, composer) {
                if (resolution == null) return false;
                if ($isPromise(resolution)) {
                    if (_instant) return false;
                    _promises.push(resolution.then(res => {
                        if (Array.isArray(res)) {
                            const satisfied = res
                                .filter(r => r && this.isSatisfied(r, composer));
                            _resolutions.push(...satisfied);
                        } else if (res && this.isSatisfied(res, composer)) {
                            _resolutions.push(res);
                        }
                    }).catch(Undefined));
                } else if (!this.isSatisfied(resolution, composer)) {
                    return false;
                } else {
                    _resolutions.push(resolution);
                }
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
                // check if handler implicitly satisfies key
                const implied  = new Binding(key);
                if (implied.match($classOf(handler), Variance.Contravariant)) {
                    resolved = this.resolve(handler, composer);
                    if (resolved && !greedy) return true;
                }
                const count    = _resolutions.length + _promises.length;
                let   resolved = $provide.dispatch(
                    handler, this, key, composer, many, this.resolve) !== $unhandled 
                    || resolved;
                return resolved || (_resolutions.length + _promises.length > count);
            }
        });
    }
});

export default Resolution;