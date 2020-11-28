import { Base, Protocol } from "miruken-core";
import { CompositeHandler } from "../src/composite-handler";
import { Errors, ErrorHandler } from "../src/handler-errors";
import { expect } from "chai";

describe("ErrorHandler", () => {
    describe("#handleError", () => {
        it("should handle errors", done => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler(),
                error        = new Error("passwords do not match");
            handler.addHandlers(errorHandler);
            Promise.resolve(Errors(handler).handleError(error)).then(() => {
                done();
            });
        });

        it("should be able to customize error handling", done => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler(),
                error        = new Error("Something bad happended");
            handler.addHandlers(errorHandler);
            var customize    = handler.decorate({
                reportError(error, handler) {
                    return Promise.resolve("custom");
                }
            });
            Promise.resolve(Errors(customize).handleError(error)).then(result => {
                expect(result).to.equal("custom");
                done();
            });
        });
    });

    describe("#handleException", () => {
        it("should handle exceptions", done => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler(),
                exception    = new TypeError("Expected a string argument");
            handler.addHandlers(errorHandler);
            Promise.resolve(Errors(handler).handleException(exception)).then(() => {
                done();
            });
        });
    })
});

describe("Handler", () => {
    var Payments = Protocol.extend({
        validateCard(card) {},
        processPayment(payment) {}
    });

    var Paymentech = Base.extend(Payments, {
        validateCard(card) {
            if (card.number.length < 10)
                throw new Error("Card number must have at least 10 digits");
        },
        processPayment(payment) {
            if (payment.amount > 500)
                return Promise.reject(new Error("Amount exceeded limit"));
        }
    });

    describe("#recoverable", () => {
        it("should implicitly recover from errors synchronously", () => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler();
            handler.addHandlers(new Paymentech(), errorHandler);
            Payments(handler.$recover()).validateCard({number:"1234"});
        });

        it("should implicitly recover from errors asynchronously", done => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler();
            handler.addHandlers(new Paymentech(), errorHandler); 
            var pay = Payments(handler.$recover()).processPayment({amount:1000});
            Promise.resolve(pay).then(result => {
                expect(result).to.be.undefined;
                done();
            });
        });

        it("should be able to customize recovery from errors asynchronously", done => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler();
            handler.addHandlers(new Paymentech(), errorHandler);
            var customize    = handler.decorate({
                reportError(error, handler) {
                    return Promise.resolve("custom");
                }
            });
            var pay = Payments(customize.$recover()).processPayment({amount:1000});
            Promise.resolve(pay).then(result => {
                expect(result).to.equal("custom");
                done();
            });
        });

        it("should recover explicitly", done => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler();
            handler.addHandlers(new Paymentech(), errorHandler);
            var pay = Payments(handler).processPayment({amount:1000})
                .catch(handler.$recoverError());
            Promise.resolve(pay).then(result => {
                expect(result).to.be.undefined;
                done();
            });
        });

        it("should be able to customize recovery explicitly", done => {
            var handler      = new CompositeHandler(),
                errorHandler = new ErrorHandler();
            handler.addHandlers(new Paymentech(), errorHandler);
            var customize    = handler.decorate({
                reportError(error, handler) {
                    return Promise.resolve("custom");
                }
            });
            var pay = Payments(handler).processPayment({amount:1000})
                .catch(customize.$recoverError());
            Promise.resolve(pay).then(result => {
                expect(result).to.equal("custom");
                done();
            });
        });
    });
});
