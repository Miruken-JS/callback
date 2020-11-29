import { 
    DuckTyping, conformsTo, $isPromise
} from "miruken-core";

import { Handler, $composer } from "./handler";
import { provides } from "./callback-policy";

/**
 * Protocol for handling and reporting errors.
 * @class Errors
 * @extends Protocol
 */    
export const Errors = DuckTyping.extend({
    /**
     * Handles an error.
     * @method handlerError
     * @param   {Any}          error      - error (usually Error)
     * @param   {Any}          [context]  - scope of error
     * @returns {Promise} promise of handled error.
     */        
    handleError(error, context) {},
    /**
     * Handles an exception.
     * @method handlerException
     * @param   {Exception}    excption   - exception
     * @param   {Any}          [context]  - scope of error
     * @returns {Promise} of handled error.
     */        
    handleException(exception, context) {},
    /**
     * Reports an error.
     * @method reportError
     * @param   {Any}          error      - error (usually Error)
     * @param   {Any}          [context]  - scope of error
     * @returns {Promise} of reported error.
     */        
    reportError(error, context) {},
    /**
     * Reports an excepion.
     * @method reportException
     * @param   {Exception}    exception  - exception
     * @param   {Any}          [context]  - scope of exception
     * @returns {Promise} of reported exception.
     */        
    reportException(exception, context) {},
    /**
     * Clears any errors for the associated context.
     * @method clearErrors
     * @param   {Any}          [context]  - scope of errors
     */
    clearErrors(context) {}
});

/**
 * Error handler.
 * @class ErrorHandler
 * @extends Handler
 * @uses Errors
 */
@provides()
@conformsTo(Errors)
export class ErrorHandler extends Handler {
    handleError(error, context) {
        const result = Errors($composer).reportError(error, context);
        return result === undefined
             ? Promise.reject(error)
             : Promise.resolve(result);
    }

    handleException(exception, context) {
        const result = Errors($composer).reportException(exception, context);
        return result === undefined
             ? Promise.reject(exception)
             : Promise.resolve(result);
    }

    reportError(error, context) {
        console.error(error);
        return Promise.resolve();
    }

    reportException(exception, context) {
        console.error(exception);
        return Promise.resolve();
    }

    clearErrors(context) {} 
}

Handler.implement({
    /**
     * Marks the handler for recovery.
     * @method $recover
     * @returns {HandlerFilter} recovery semantics.
     * @for Handler
     */        
    $recover(context) {
        return this.filter((callback, composer, proceed) => {
            try {
                const handled = proceed();
                if (!("callbackResult" in callback)) {
                    return handled;
                }
                if (handled) {
                    const result = callback.callbackResult;
                    if ($isPromise(result)) {
                        callback.callbackResult = result.catch(err =>
                            Errors(composer).handleError(err, context));
                    }
                }
                return handled;
            } catch (ex) {
                Errors(composer).handleException(ex, context);
                return true;
            }
        });
    },
    /**
     * Creates a function to pass error promises to Errors feature.
     * @method $recoverError
     * @returns {Function} function to pass error promises to Errors feature. 
     * @for Handler
     */        
    $recoverError(context) {
        return error => Errors(this).handleError(error, context);
    }
});
