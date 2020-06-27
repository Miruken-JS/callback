import { Protocol } from "miruken-core";

export const CallbackControl = Protocol.extend({
    /**
     * Tags this callback for boundary checking.
     * @property {Any} bounds
     * @readOnly
     */    
    get bounds() {},

    /**
     * Returns true if this callback can participate in batching.
     * @property {Boolean} canBatch
     * @readOnly
     */    
    get canBatch() {},

    /**
     * Returns true if this callback can participate in filtering.
     * @property {Boolean} canFilter
     * @readOnly
     */    
    get canFilter() {},

    /**
     * Returns true if this callback can participate in inference.
     * @property {Boolean} canInfer
     * @readOnly
     */    
    get canInfer() {},

    /**
     * Gets the callback policy.
     * @property {Function} policy
     * @readOnly
     */
    callbackPolicy: undefined,

    /**
     * Guards the callback dispatch.
     * @method dispatch
     * @param   {Object}   handler     -  target handler
     * @param   {Any}      binding     -  usually Binding
     * @returns {Function} truthy if dispatch can proceed.
     * If a function is returned it will be called after
     * the dispatch with *this* callback as the receiver.
     */
    guardDispatch(handler, binding) {},

    /**
     * Dispatches the callback.
     * @method dispatch
     * @param   {Object}   handler     -  target handler
     * @param   {boolean}  greedy      -  true if handle greedily
     * @param   {Handler}  [composer]  -  composition handler
     * @returns {boolean} true if the callback was handled, false otherwise.
     */
    dispatch(handler, greedy, composer) {},
});

export default CallbackControl;