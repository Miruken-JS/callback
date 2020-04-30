/**
 * Identifies a callback that could not be handled.
 * @class NotHandledError
 * @constructor
 * @param {Object}  callback  -  unhandled callback
 * @param {string}  message   -  message
 * @extends Error
 */
export function NotHandledError(callback, message) {
    /**
     * Gets the unhandled callback.
     * @property {Object} callback
     */         
    this.callback = callback;

    this.message = message || `${callback} not handledcd`;

    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Error.call(this);
    }
}
NotHandledError.prototype             = new Error();
NotHandledError.prototype.constructor = NotHandledError;

/**
 * Identifies a rejected callback.  This usually occurs from aspect processing.
 * @class RejectedError
 * @constructor
 * @param {Object}  callback  -  rejected callback
 * @extends Error
 */
export function RejectedError(callback) {
    /**
     * Gets the rejected callback.
     * @property {Object} callback
     */         
    this.callback = callback;

    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Error.call(this);
    }
}
RejectedError.prototype             = new Error();
RejectedError.prototype.constructor = RejectedError;

/**
 * Identifies a timeout error.
 * @class TimeoutError
 * @constructor
 * @param {Object}  callback  -  timed out callback
 * @param {string}  message   -  timeout message
 * @extends Error
 */
export function TimeoutError(callback, message) {
    /**
     * Gets the rejected callback.
     * @property {Object} callback
     */         
    this.callback = callback;
    
    this.message = message || "Timeout occurred";
    
    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Error.call(this);
    }
}
TimeoutError.prototype             = new Error();
TimeoutError.prototype.constructor = TimeoutError;