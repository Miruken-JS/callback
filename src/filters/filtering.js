import { Protocol } from "miruken-core";

/**
 * Protocol for providing filters.
 * @class FilteringProvider
 * @extends Protocol
 */
export const FilteringProvider = Protocol.extend({
    /**
     * Reports if the filters are required.
     * @property {Boolean} required
     * @readOnly
     */        
    get required() {},

    /**
     * Determines if any filters apply to the `callback`.
     * @method appliesTo
     * @returns {Boolean} true if one or more filters apply,
     * false if none apply, or undefined if unknown.
     */
    appliesTo(callback) {},
    /**
     * Gets the filters for the `callback`.
     * @method getFilters
     * @param  {Binding}   binding   -  handler binding
     * @param  {Any}       callback  -  callback
     * @param  {Handler}   composer  -  handler composer
     * @returns {Boolean} true if one or more filters apply.
     */    
    getFilters(binding, callback, composer) {}
});

/**
 * Protocol for filtering callbacks.
 * @class Filtering
 * @extends Protocol
 */
export const Filtering = Protocol.extend({
    /**
     * Gets the filter order.
     * @property {Number} order
     * @readOnly
     */    
    get order() {},

    /**
     * Executes the filter for the `callback`.
     * @method next
     * @param  {Object}    ...dependecies  -  dependencies
     * @param  {Object}    context         -  context information which include
     *    Next, Binding, FilteringProvider and Composer
     * @returns {Any} the result of the filter.
     */
    next(callback, next, context) {}
});

/**
 * Protocol for filter containment.
 * @class Filtered
 * @extends Protocol
 */
export const Filtered = Protocol.extend({
    /**
     * Returns the providers.
     * @property {FilteringProvider} ...filters
     * @readOnly
     */ 
    get filters() {},

    /**
     * Adds the `providers` to this object.
     * @method addFilters
     * @param  {FilteringProvider}  ...providers  -  providers
     */  
    addFilters(providers) {},
    /**
     * Removes the `providers` from this object.
     * @method removeFilters
     * @param  {FilteringProvider}  ...providers  -  providers
     */     
    removeFilters(providers) {},
    /**
     * Removes all the `providers` from this object.
     * @method removeAllFilters
     */      
    removeAllFilters() {}
});

export default Filtering;
