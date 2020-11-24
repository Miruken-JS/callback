import { True, type } from "miruken-core";
import { Handler } from "../src/handler";
import { HandlerBuilder } from "../src/handler-builder";
import { provides } from "../src/callback-policy";
import * as cars from "./cars";
import { expect } from "chai";

describe("HandlerBuilder", () => {
    @provides()
    class Mechanic {
        repair(@type(cars.Car) car) {

        }
    }

    it("should provide types explicitly", () => {
        const handler = new HandlerBuilder()
            .addSources(sources => sources.fromTypes(Mechanic))
            .selectTypes(types => types.where(True))
            .build();
        expect(handler).to.be.instanceOf(Handler);
        expect(handler.resolve(Mechanic)).to.be.instanceOf(Mechanic);
    });

    it("should provide types implicitly from modules", () => {
        const handler = new HandlerBuilder()
            .addSources(sources => sources.fromModules(cars))
            .selectTypes(types => types.where(True))
            .build();
        expect(handler).to.be.instanceOf(Handler);
        expect(handler.resolve(cars.Junkyard)).to.be.instanceOf(cars.CraigsJunk);
    });

    it("should provide types implicitly with explicit dependencies", () => {
        const handler = new HandlerBuilder()
            .addSources(sources => sources.fromModules(cars))
            .selectTypes(types => types.where(True))
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
            .addSources(sources => sources.fromModules(cars))
            .selectTypes(types => types.where(True))
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
            .addSources(sources => sources.fromModules(cars))
            .selectTypes(types => types.where(True))
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
        
        expect(2).to.equal(engines.length);
        const engine  = engines.find(e => e instanceof cars.Supercharger);
        expect(engine.boost).to.equal(20);
        expect(engine.horsepower).to.equal(4305);
        expect(engine.displacement).to.equal(4);
        expect(cars.Diagnostics.isAdoptedBy(engine.diagnostics)).to.be.true;
    });

    it("should require explicitly provided types", () => {
        const handler = new HandlerBuilder()
            .addSources(sources => sources.fromModules(cars))
            .selectTypes(types => types.where(True))
            .provideExplicitly()
            .build();
        expect(handler.resolve(cars.Junkyard)).to.be.undefined;
    });

    it("should provide singleton types implicitly by default", () => {
        const handler = new HandlerBuilder()
            .addSources(sources => sources.fromModules(cars))
            .selectTypes(types => types.where(True))
            .build();
        const junkyard = handler.resolve(cars.Junkyard);
        expect(junkyard).to.be.instanceOf(cars.CraigsJunk);
        expect(handler.resolve(cars.Junkyard)).to.equal(junkyard);
    });
});
