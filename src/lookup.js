import {
    Base, Undefined, $isPromise,
    $isNothing, $instant, $flatten
} from "miruken-core";

import { $lookup } from "./policy";
import { DispatchingCallback, $unhandled } from "./callback";

/**
 * Callback representing the invariant lookup of a key.
 * @class Lookup
 * @constructor
 * @param   {Any}      key   -  lookup key
 * @param   {boolean}  many  -  lookup cardinality
 * @extends Base
 */
export const Lookup = Base.extend(DispatchingCallback, {
    constructor(key, many) {
        if ($isNothing(key)) {
            throw new TypeError("The key is required.");
        }
        many = !!many;
        let _results = [],
            _promises    = [],
            _instant     = $instant.test(key),
            _result;
        this.extend({
            /**
             * Gets the lookup key.
             * @property {Any} key
             * @readOnly
             */
            get key() { return key; },
            /**
             * true if lookup all, false otherwise.
             * @property {boolean} many
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
             * Gets the matching results.
             * @property {Array} results
             * @readOnly
             */
            get results() { return _results; },        
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */                
            get callbackResult() {
                if (_result === undefined) {
                    if (this.instant) {
                        _result = many ? _results : _results[0];
                    } else {
                        _result = many 
                                ? Promise.all(_promises).then(() => _results)
                                : Promise.all(_promises).then(() => _results[0]);
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Adds a lookup result.
             * @param  {Any}      reault    -  lookup result
             * @param  {Handler}  composer  -  composition handler
             * @returns {boolean} true if accepted, false otherwise.
             */
            addResult(result, composer) {
                let found;
                if (result == null) return false;
                if (Array.isArray(result)) {
                    found = $flatten(result, true).reduce(
                        (s, r) => this.include(r, composer) || s, false);  
                } else {
                    found = this.include(result, composer);
                }
                if (found) {
                    _result = undefined;
                }
                return found;
            },
            include(result, composer) {
                if (result == null) return false;
                if ($isPromise(result)) {
                    if (_instant) return false;
                    _promises.push(result.then(res => {
                        if (Array.isArray(res)) {
                            _results.push(...res.filter(r => r != null));
                        } else if (res != null) {
                            _results.push(res);
                        }
                    }).catch(Undefined));
                } else {
                    _results.push(result);
                }
                return true;                             
            },           
            dispatch(handler, greedy, composer) {
                const count = _results.length + _promises.length,
                      found = $lookup.dispatch(handler, this, this.key,
                        composer, this.isMany, this.addResult) !== $unhandled;
                return found || (_results.length + _promises.length > count);
            }           
        });
    },
    /**
     * Gets the policy.
     * @property {Function} policy
     * @readOnly
     */         
    get policy() { return $lookup; }      
});

export default Lookup;