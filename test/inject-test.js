import { 
    Base, Protocol
} from "miruken-core";

import { inject } from "../src/inject";

import { expect } from "chai";

/*
const Engine = Protocol.extend({
    get numberOfCylinders() {},
    get horsepower() {},
    get displacement() {},
    get rpm() {},
    rev(rpm) {}
});

const Car = Protocol.extend({
    get make() {},
    get model() {},
    get engine () {}
});

const Diagnostics = Protocol.extend({
    get mpg() {}
});

const Junkyard = Protocol.extend({
    decomission(part) {}
});

const V12 = Base.extend(Engine, {
    @inject(_,_,$optional(Diagnostics))
    constructor(horsepower, displacement, diagnostics) {
        let _rpm;
        this.extend({
            get horsepower() { return horsepower; },
            get displacement() { return displacement; },
            get diagnostics() { return diagnostics; },
            get rpm() { return _rpm; },
            rev(rpm) {
                if (rpm <= 8000) {
                    _rpm = rpm;
                    return true;
                }
                return false;
            }
        });
    },
    initialize() {
        Object.defineProperty(this, "calibrated", { value: true });
    },
    get numberOfCylinders() { return 12; }
});

const RebuiltV12 = V12.extend(Engine, Disposing, {
    @inject(_,_,_,Junkyard)
    constructor(horsepower, displacement, diagnostics, junkyard) {
        this.base(horsepower, displacement, diagnostics, junkyard);
        this.extend({
            dispose() {
                junkyard.decomission(this);
            }
        });
    }
});

const Supercharger = Base.extend(Engine, {
    @inject(Engine)
    constructor(engine, boost) {
        this.extend({
            get horsepower() {
                return engine.horsepower * (1.0 + boost); 
            },
            get displacement() {
                return engine.displacement; 
            }
        });
    }
});

const Ferrari = Base.extend(Car, {
    @inject(_,Engine)
    constructor(model, engine) {
        this.extend({
            get make() { return "Ferrari"; },
            get model() { return model; },
            get engine() { return engine; }
        });
    }
});

const Bugatti = Base.extend(Car, {
    @inject(_,Engine)
    constructor(model, engine) {
        this.extend({
            get make() { return "Bugatti"; },
            get model() { return model; },
            get engine() { return engine; }
        });
    }
});

const Auction = Base.extend({
    @inject($all(Car))
    constructor(cars) {
        let inventory = {};
        cars.forEach(car => {
            const make   = car.make;
            let   models = inventory[make];
            if (!models) {
                inventory[make] = models = [];
            }
            models.push(car);
        });
        this.extend({
            get cars() { return inventory; }
        });
    }
});

const OBDII = Base.extend(Diagnostics, {
    constructor() {
        this.extend({
            get mpg() { return 22.0; }
        });
    }
});

const CraigsJunk = Base.extend(Junkyard, {
    constructor() {
        let _parts = [];
        this.extend({
            get parts() { return _parts.slice(0); },
            decomission(part) { _parts.push(part); }
        });
    }
});

describe("@inject", () => {

});

*/