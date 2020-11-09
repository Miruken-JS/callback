import { 
    Base, Protocol, conformsTo,
    disposable, all, optional,
    createKey
} from "miruken-core";

import { inject } from "../src/inject";
import { initialize } from "../src/initializer";
import { expect } from "chai";

const _ = createKey();

export const Engine = Protocol.extend({
    get numberOfCylinders() {},
    get horsepower() {},
    get displacement() {},
    get rpm() {},
    rev(rpm) {}
});

export const Car = Protocol.extend({
    get make() {},
    get model() {},
    get engine() {}
});

export const Diagnostics = Protocol.extend({
    get mpg() {}
});

export const Junkyard = Protocol.extend({
    decomission(part) {}
});

@conformsTo(Engine)
export class V12 {
    constructor(
        @inject                        horsepower,
        @inject                        displacement,
        @inject(Diagnostics) @optional diagnostics) {

        _(this).horsepower   = horsepower;
        _(this).displacement = displacement;
        _(this).diagnostics  = diagnostics;
    }

    @initialize
    initialize() {
        Object.defineProperty(this, "calibrated", { value: true });
    }

    get horsepower() { return _(this).horsepower; }
    get displacement() { return _(this).displacement; }
    get diagnostics() { return _(this).diagnostics; }
    get numberOfCylinders() { return 12; }

    get rpm() { return _(this).rpm; }
    rev(rpm) {
        if (rpm <= 8000) {
            _(this).rpm = rpm;
            return true;
        }
        return false;
    }
}

export class RebuiltV12 extends disposable(V12) {
    constructor(
        @inject           horsepower,
        @inject           displacement,
        @inject           diagnostics,
        @inject(Junkyard) junkyard) {

        super(horsepower, displacement, diagnostics);
        _(this).junkyard = junkyard;
    }

    _dispose() {
        _(this).junkyard.decomission(this);
    }
}

@conformsTo(Engine)
export class Supercharger {
    constructor(
        @inject(Engine) engine,
        @inject         boost) {

        _(this).engine = engine;
        _(this).boost  = boost;
    }

    get boost() { return _(this).boost; }
    get displacement() {
        return _(this).engine.displacement; 
    }    
    get horsepower() {
        return _(this).engine.horsepower * (1.0 + this.boost); 
    }
}

@conformsTo(Car)
export class Ferrari {
    constructor(
        @inject         model,
        @inject(Engine) engine) {

        _(this).model  = model;
        _(this).engine = engine;
    }

    get make() { return "Ferrari"; }
    get model() { return _(this).model; }
    get engine() { return _(this).engine; }
}

@conformsTo(Car)
export class Bugatti {
    constructor(
        @inject         model,
        @inject(Engine) engine) {
        _(this).model  = model;
        _(this).engine = engine; 
    }

    get make() { return "Bugatti"; }
    get model() { return _(this).model; }
    get engine() { return _(this).engine; }    
}

export class Auction {
    constructor(@inject(Car) @all cars) {
        const inventory = {};
        cars.forEach(car => {
            const make   = car.make;
            let   models = inventory[make];
            if (!models) {
                inventory[make] = models = [];
            }
            models.push(car);
        });
        _(this).inventory = inventory;
    }

     get cars() { return _(this).inventory; }
}

@conformsTo(Diagnostics)
export class OBDII {
    get mpg() { return 22.0; }
}

@conformsTo(Junkyard)
export class CraigsJunk  {
    constructor() {
        _(this).parts = [];
    }

    get parts() { return _(this)._parts.slice(0); }

    decomission(part) { _(this)._parts.push(part); }
}

describe("@inject", () => {

});
