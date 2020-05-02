import { Protocol } from "miruken-core";

export const DispatchingCallback = Protocol.extend({
    /**
     * Gets the policy.
     * @property {Function} policy
     * @readOnly
     */
    policy: undefined,

    /**
     * Dispacthes the callback using this policy.
     * @method dispatch
     * @param   {Object}   handler     -  target handler
     * @param   {boolean}  greedy      -  true if handle greedily
     * @param   {Handler}  [composer]  -  composition handler
     * @returns {boolean} true if the callback was handled, false otherwise.
     */
    dispatch(handler, greedy, composer) {}
});
