import { createKey } from "miruken-core";

const _ = createKey();

/**
 * Identifies a callback that could not be handled.
 * @class NotHandledError
 * @constructor
 * @param {Object}  callback  -  unhandled callback
 * @param {string}  message   -  message
 * @extends Error
 */
export class NotHandledError extends Error {
    constructor(callback, message) {
        super(message || `${callback} not handled.`);

        _(this).callback = callback;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    get callback() { return _(this).callback; }
}

/**
 * Identifies a rejected callback.  This usually occurs from aspect processing.
 * @class RejectedError
 * @constructor
 * @param {Object}  callback  -  rejected callback
 * @extends Error
 */
export class RejectedError extends Error {
    constructor(callback, message) {
        super(message || `${callback} rejected.`);

         _(this).callback = callback;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    get callback() { return _(this).callback; }
}

/**
 * Identifies a timeout error.
 * @class TimeoutError
 * @constructor
 * @param {Object}  callback  -  timed out callback
 * @param {string}  message   -  timeout message
 * @extends Error
 */
export class TimeoutError extends Error {
    constructor(callback, message) {
        super(message || `${callback} timeout.`);

         _(this).callback = callback;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }  
    }

    get callback() { return _(this).callback; }
}
