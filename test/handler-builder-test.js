import { True, type } from "miruken-core";
import { Handler } from "../src/handler";
import { HandlerBuilder } from "../src/handler-builder";
import { provides } from "../src/callback-policy";
import * as cars from "./cars";
import * as casino from "./callback-test";
import { expect } from "chai";

describe("HandlerBuilder", () => {
    @provides()
    class Mechanic {
        repair(@type(cars.Car) car) {

        }
    }

    it("should provide types explicitly", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.types(Mechanic))
            .takeTypes(that => that.satisfy(True))
            .build();
        expect(handler).to.be.instanceOf(Handler);
        expect(handler.resolve(Mechanic)).to.be.instanceOf(Mechanic);
    });

    it("should provide types implicitly from modules", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(cars))
            .takeTypes(that => that.satisfy(True))
            .build();
        expect(handler).to.be.instanceOf(Handler);
        expect(handler.resolve(cars.Junkyard)).to.be.instanceOf(cars.CraigsJunk);
    });

    it("should provide types implicitly with explicit dependencies", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(cars))
            .takeTypes(that => that.satisfy(True))
            .build();
        const engine = handler.$withKeyValues({
            horsepower:   205,
            displacement: 4
        }).resolve(cars.Engine);
        expect(engine).to.not.be.undefined;
        expect(engine.horsepower).to.equal(205);
        expect(engine.displacement).to.equal(4);
        expect(cars.Diagnostics.isAdoptedBy(engine.diagnostics)).to.be.true;
    });

    it("should provide types implicitly with target bindings", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(cars))
            .takeTypes(that => that.satisfy(True))
            .build();
        const engine = handler.$withBindings(cars.V12, {
            horsepower:   205,
            displacement: 4
        }).resolve(cars.Engine);
        expect(engine).to.be.instanceOf(cars.V12);
        expect(engine.horsepower).to.equal(205);
        expect(engine.displacement).to.equal(4);
        expect(cars.Diagnostics.isAdoptedBy(engine.diagnostics)).to.be.true;
    });

    it("should provide decorated types with target bindings", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(cars))
            .takeTypes(that => that.satisfy(True))
            .build();
        const engines = handler
            .$withBindings(cars.V12, {
                horsepower:   205,
                displacement: 4
            })
            .$withBindings(cars.Supercharger, {
                boost: 20
            })            
            .resolveAll(cars.Engine);
        
        expect(engines.length).to.equal(2);
        const engine  = engines.find(e => e instanceof cars.Supercharger);
        expect(engine.boost).to.equal(20);
        expect(engine.horsepower).to.equal(4305);
        expect(engine.displacement).to.equal(4);
        expect(cars.Diagnostics.isAdoptedBy(engine.diagnostics)).to.be.true;
    });

    it("should require explicitly provided types", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(cars).types(Mechanic))
            .takeTypes(that => that.satisfy(True))
            .explicitConstructors()
            .build();
        expect(handler.resolve(Mechanic)).to.be.instanceOf(Mechanic);
        expect(handler.resolve(cars.Junkyard)).to.be.undefined;
    });

    it("should construct implicity if arguments known", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(casino))
            .build();
        expect(handler.resolve(casino.Casino)).to.be.undefined;
    });

    it("should select types that conform to protocols", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(casino))
            .takeTypes(that => that.conformTo(casino.Security))
            .build();
        const security = handler.resolveAll(casino.Security);
        expect(security.length).to.equal(2);
        expect(security.map(s => s.constructor))
            .to.include(casino.Level1Security, casino.Level2Security);
    });

    it("should select types that derive from a class exclusive", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(casino))
            .takeTypes(that => that.extendFrom(casino.Accountable))
            .build();
        const accountable = handler.resolveAll(casino.Accountable);
        expect(accountable.length).to.equal(1);
        expect(accountable.map(s => s.constructor)).to.include(casino.Cashier);
    });

    it("should select types that derive from a class inclusive", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(casino))
            .takeTypes(that => that.extendFrom(casino.Accountable, true))
            .build();
        const accountable = handler.resolveAll(casino.Accountable);
        expect(accountable.length).to.equal(1);
        expect(accountable.map(s => s.constructor)).to.include(casino.Cashier);
    });

    it("should provide singleton types implicitly by default", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(cars))
            .takeTypes(that => that.satisfy(True))
            .build();
        const junkyard = handler.resolve(cars.Junkyard);
        expect(junkyard).to.be.instanceOf(cars.CraigsJunk);
        expect(handler.resolve(cars.Junkyard)).to.equal(junkyard);
    });

    it("should provide types implicitly with lifestyle override", () => {
        const handler = new HandlerBuilder()
            .addTypes(from => from.modules(cars))
            .takeTypes(that => that.satisfy(True).implicitConstructors([]))
            .build();
        const junkyard = handler.resolve(cars.Junkyard);
        expect(junkyard).to.be.instanceOf(cars.CraigsJunk);
        expect(handler.resolve(cars.Junkyard)).to.not.equal(junkyard);
    });    
});
