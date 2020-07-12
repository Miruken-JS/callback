import {
    Protocol, type, conformsTo,
    createKeyChain
} from "miruken-core";

import { provides } from "../src/callback-policy";
import InferenceHandler from "../src/inference-handler";

import named from "../src/bindings/named";
import metadata from "../src/bindings/metadata";
import createQualifier from "../src/bindings/qualifier-constraint";

import { expect } from "chai";

const _ = createKeyChain();

const Person = Protocol.extend({
    get firstName() {},
    get lastName() {}
});

@conformsTo(Person)
class PersonData {
    constructor(firstName, lastName) {
        this.firstName = firstName;
        this.lastName  = lastName;
    }

    get firstName() {
        return _(this).firstName;
    }
    set firstName(value) {
        _(this).firstName = value;
    }

    get lastName() {
        return _(this).lastName;
    }
    set lastName(value) {
        _(this).lastName = value;
    }
}

const doctor     = metadata("job", "doctor"),
      programmer = createQualifier();

@provides()
class Hospital {
    constructor(
        @doctor     @type(Person) doctor,
        @programmer @type(Person) programmer) {
        _(this).doctor     = doctor;
        _(this).programmer = programmer;
    }

    get doctor() { return _(this).doctor; }
    get programmer() { return _(this).programmer; }
}

class PersonProvider {
    @provides(Person) @doctor
    static getDoctor() {
        return new PersonData("Jack", "Zigler");
    }

    @provides(Person) @programmer
    static getProgrammer() {
        return new PersonData("Paul", "Allen");
    }
}

const Configuration = Protocol.extend({
    get serverUrl() {}
});

@provides() @named("local")
@conformsTo(Configuration) class LocalConfiguration {
    get serverUrl() { return "http://localhost/Server"; }
}

@provides() @named("remote")
@conformsTo(Configuration) class RemoteConfiguration {
    get serverUrl() { return "http://remote/Server"; }
}

@provides()
class Client {
    constructor(
        @named("local")  @type(Configuration) local,
        @named("remote") @type(Configuration) remote
    ) {
        _(this).local  = local;
        _(this).remote = remote;
    }

    get local()  { return _(this).local; }
    get remote() { return _(this).remote; }
}

class Coach {}
const division1 = createQualifier(),
      division2 = metadata("division", 2);

@provides() @division1
class Coach1 extends Coach {}

@provides() @division2
class Coach2 extends Coach {}

describe("NamedConstraint", () => {
    let handler;
    beforeEach(() => {
        handler = new InferenceHandler(
            PersonProvider, LocalConfiguration,
            RemoteConfiguration, Hospital, Client,
            Coach1, Coach2);
    });

    it("should resolve instance without name", () => {
        const configuration = handler.resolve(Configuration);
        expect(configuration).to.exist;
        expect(Configuration.isAdoptedBy(configuration)).to.be.true;
    });

    it("should resolve all instances without name", () => {
        const configurations = handler.resolveAll(Configuration);
        expect(configurations.length).to.equal(2);
    });

    it("should resolve instance by name", () => {
        const local = handler.resolve(Configuration, c => c.named("local"));
        expect(local).to.be.instanceOf(LocalConfiguration);
        expect(local.serverUrl).to.equal("http://localhost/Server");

        const remote = handler.resolve(Configuration, c => c.named("remote"));
        expect(remote).to.be.instanceOf(RemoteConfiguration);
        expect(remote.serverUrl).to.equal("http://remote/Server");
    });

    it("should resolve all instances by name", () => {
        const configurations = handler.resolveAll(Configuration, c => c.named("remote"));
        expect(configurations.length).to.equal(1);
        expect(configurations[0]).to.be.instanceOf(RemoteConfiguration);
    });

    it("should inject dependency based on name", () => {
        const client = handler.resolve(Client);
        expect(client).to.exist;
        expect(client.local.serverUrl).to.equal("http://localhost/Server");
        expect(client.remote.serverUrl).to.equal("http://remote/Server");
    });

    it("should resolve instance based on qualifier", () => {
        const dr = handler.resolve(Person, c => c.require(doctor));
        expect(dr).to.exist;
        expect(dr.firstName).to.equal("Jack");
        expect(dr.lastName).to.equal("Zigler");

        const prg = handler.resolve(Person, c => c.require(programmer));
        expect(prg).to.exist;
        expect(prg.firstName).to.equal("Paul");
        expect(prg.lastName).to.equal("Allen");        
    });

    it("should resolve all instances based on qualifier", () => {
        const prgs = handler.resolveAll(Person, c => c.require(programmer));
        expect(prgs.length).to.equal(1);
        expect(prgs[0].firstName).to.equal("Paul");
        expect(prgs[0].lastName).to.equal("Allen");           
    });

    it("should inject dependency based on constraints", () => {
        const hospital = handler.resolve(Hospital);
        expect(hospital).to.exist;
        expect(hospital.doctor.firstName).to.equal("Jack");
        expect(hospital.doctor.lastName).to.equal("Zigler");
        expect(hospital.programmer.firstName).to.equal("Paul");
        expect(hospital.programmer.lastName).to.equal("Allen");           
    });

    it("should resolve instance based on class constraint", () => {
        const coach1 = handler.resolve(Coach, c => c.require(division1));
        expect(coach1).to.be.instanceOf(Coach1);

        const coach2 = handler.resolve(Coach, c => c.require(division2));
        expect(coach2).to.be.instanceOf(Coach2);
    });
});
