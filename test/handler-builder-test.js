import { type } from "miruken-core";
import { HandlerBuilder } from "../src/handler-builder";
import * as cars from "./inject-test";

import { expect } from "chai";

describe("HandlerBuilder", () => {
    class Mechanic {
        repair(@type(cars.Car) car) {

        }
    }

    it("should provide types explicitly", () => {
        const handler = new HandlerBuilder()
            .addSources(addSources =>
                addSources.fromTypes(Mechanic))
            .build();
    });

    it("should provide types from modules", () => {
        const handler = new HandlerBuilder()
            .addSources(addSources =>
                addSources.fromModules(cars))
            .build();
    });
});
