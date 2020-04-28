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
        let _results = [], _result,
            _instant = $instant.test(key);
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
             * Gets the matching results.
             * @property {Array} results
             * @readOnly
             */
            get results() { return _results; },
             /**
             * Gets the policy.
             * @property {Function} policy
             * @readOnly
             */         
            get policy() { return $lookup; },           
            /**
             * Gets/sets the effective callback result.
             * @property {Any} callback result
             */                
            get callbackResult() {
                if (_result === undefined) {
                    if (!many) {
                        if (_results.length > 0) {
                            _result = _results[0];
                        }
                    } else if (_instant) {
                        _result = $flatten(_results);
                    } else {
                        _result = Promise.all(_results).then($flatten);
                    }
                }
                return _result;
            },
            set callbackResult(value) { _result = value; },
            /**
             * Adds a lookup result.
             * @param  {Any}  reault - lookup result
             */
            addResult(result) {
                if ((many || _results.length === 0) &&
                    !(_instant && $isPromise(result))) {
                    _results.push(result);
                    _result = undefined;
                }
            },
            dispatch(handler, greedy, composer) {
                return $lookup.dispatch(handler, this, this.key,
                    composer, this.isMany, this.addResult) !== $unhandled; 
            }           
        });
    }
});

export default Lookup;