import {
    Base, Enum, design, createKeyChain 
} from "miruken-core";

import { HandlerBuilder } from "../../src/handler-builder";

import { 
    root, ignore
} from "../../src/map/mapping";

import { MapTo } from "../../src/map/map-callback";

import { 
    JsonFormat, JsonMapping
} from "../../src/map/json-mapping";

import { 
    mapsFrom, mapsTo, format
} from "../../src/map/maps";

import { 
    TypeIdHandling, TypeMapping, typeId, typeInfo
} from "../../src/map/type-mapping";

import "../../src/map/handler-builder-map";

import { expect } from "chai";

const _ = createKeyChain();

const Color = Enum({red: 1, blue: 2, green: 3});

@typeId("Person")
class Person extends Base {
    firstName = undefined
    lastName  = undefined
    age       = undefined

    @ignore
    password  = undefined

    @design(Color)
    eyeColor  = undefined

    get hobbies() { return _(this).hobbies; }
    set hobbies(value) { _(this).hobbies = value; }
}

@typeId("Doctor")
class Doctor extends Person {
    @design(Person)
    nurse    = undefined

    @design([Person])
    patients = undefined    
}

class PersonWrapper extends Base {
    @root                
    @design(Person)
    person = undefined
}

describe("JsonMapping", () => {
    let handler;
    beforeEach(() => {
        handler = new HandlerBuilder()
            .withJsonMapping()
            .build();
    });
    
    describe("#mapTo", () => {
        it("should map from json", () => {
            const person = handler.mapTo({
                firstName:  "David",
                lastName:   "Beckham",
                eyeColor:   2,
                occupation: "soccer"
            }, JsonFormat, Person);
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.eyeColor).to.equal(Color.blue);
            expect(person.occupation).to.be.undefined;
        });

        it("should ignore from json", () => {
            const person = handler.mapTo({
                password: "1234"
            }, JsonFormat, Person);
            expect(person).to.be.instanceOf(Person);
            expect(person.password).to.be.undefined;
        });
        
        it("should pass through primitives", () => {
            expect(handler.mapTo(1, JsonFormat)).to.equal(1);
            expect(handler.mapTo(2, JsonFormat)).to.equal(2);
            expect(handler.mapTo(true, JsonFormat)).to.equal(true); 
            expect(handler.mapTo(false, JsonFormat)).to.equal(false);           
            expect(handler.mapTo("hello", JsonFormat)).to.equal("hello");
            expect(handler.mapTo("goodbye", JsonFormat)).to.equal("goodbye");
        });

        it("should map enum value", () => {
            expect(handler.mapTo(1, JsonFormat, Color)).to.equal(Color.red);
            expect(handler.mapTo(2, JsonFormat, Color)).to.equal(Color.blue);
            expect(handler.mapTo(3, JsonFormat, Color)).to.equal(Color.green);
            expect(() => {
                expect(handler.mapTo(4, JsonFormat, Color)).to.equal(Color.green);                            
            }).to.throw(TypeError, "4 is not a valid value for this Enum");
        });
        
        it("should map all from json", () => {
            const person = handler.mapTo({
                firstName:  "David",
                lastName:   "Beckham",
                occupation: "soccer"
            }, JsonFormat, Person, MapTo.dynamic);
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.equal("soccer");
        });

        it("should use type id to parse json", () => {
            const person = handler.mapTo({
                $type:      "Doctor",
                firstName:  "Daniel",
                lastName:   "Worrell",
                occupation: "Orthopedic"
            }, JsonFormat, Person, MapTo.dynamic);
            expect(person).to.be.instanceOf(Doctor);
            expect(person.firstName).to.equal("Daniel");
            expect(person.lastName).to.equal("Worrell");
            expect(person.occupation).to.equal("Orthopedic");
        });

        it("should map all related from json", () => {
            const doctor = handler.mapTo({
                firstName: "Mitchell",
                lastName:  "Moskowitz",
                hobbies:   ["golf", "cooking", "reading"],
                nurse: {
                    firstName:  "Clara",
                    lastName:   "Barton",
                    age:         36
                },                
                patients: [{
                    firstName:  "Lionel",
                    lastName:   "Messi",
                    occupation: "soccer",
                    age:         24
                }]
            }, JsonFormat, Doctor, MapTo.dynamic);
            expect(doctor).to.be.instanceOf(Doctor);
            expect(doctor.firstName).to.equal("Mitchell");
            expect(doctor.lastName).to.equal("Moskowitz");
            expect(doctor.hobbies).to.eql(["golf", "cooking", "reading"]);
            expect(doctor.nurse).to.be.instanceOf(Person);
            expect(doctor.nurse.firstName).to.equal("Clara");
            expect(doctor.nurse.lastName).to.equal("Barton");
            expect(doctor.nurse.age).to.equal(36);
            expect(doctor.patients[0]).to.be.instanceOf(Person);
            expect(doctor.patients[0].firstName).to.equal("Lionel");
            expect(doctor.patients[0].lastName).to.equal("Messi");
            expect(doctor.patients[0].age).to.equal(24);
        });

        it("should map all related from json using type id", () => {
            const doctor = handler.mapTo({
                firstName: "Mitchell",
                lastName:  "Moskowitz",
                hobbies:   ["golf", "cooking", "reading"],
                nurse: {
                    $type:      "Doctor",
                    firstName:  "Clara",
                    lastName:   "Barton",
                    occupation: "Red Cross",
                    age:         36
                },                
                patients: [{
                    $type:      "Doctor",
                    firstName:  "Louis",
                    lastName:   "Pasteur",
                    occupation: "Biologist",
                    age:         75
                }]
            }, JsonFormat, Doctor, MapTo.dynamic);
            expect(doctor).to.be.instanceOf(Doctor);
            expect(doctor.firstName).to.equal("Mitchell");
            expect(doctor.lastName).to.equal("Moskowitz");
            expect(doctor.hobbies).to.eql(["golf", "cooking", "reading"]);
            expect(doctor.nurse).to.be.instanceOf(Doctor);
            expect(doctor.nurse.firstName).to.equal("Clara");
            expect(doctor.nurse.lastName).to.equal("Barton");
            expect(doctor.nurse.occupation).to.equal("Red Cross");
            expect(doctor.nurse.age).to.equal(36);
            expect(doctor.patients[0]).to.be.instanceOf(Doctor);
            expect(doctor.patients[0].firstName).to.equal("Louis");
            expect(doctor.patients[0].lastName).to.equal("Pasteur");
            expect(doctor.patients[0].occupation).to.equal("Biologist");
            expect(doctor.patients[0].age).to.equal(75);
        });

        it("should map all related from json ignoring case", () => {
            const doctor = handler.mapTo({
                FirstNAME: "Mitchell",
                LASTName:  "Moskowitz",
                nurse: {
                    FIRSTName:  "Clara",
                    lastNAME:   "Barton"
                }
            }, JsonFormat, Doctor);
            expect(doctor).to.be.instanceOf(Doctor);
            expect(doctor.nurse).to.be.instanceOf(Person);
            expect(doctor.firstName).to.equal("Mitchell");
            expect(doctor.lastName).to.equal("Moskowitz");            
            expect(doctor.nurse.firstName).to.equal("Clara");
            expect(doctor.nurse.lastName).to.equal("Barton");
        });

        it("should map arrays", () => {
            const people = handler.mapTo([{
                     firstName:  "David",
                     lastName:   "Beckham",
                     occupation: "soccer"
                  }], JsonFormat, [Person], MapTo.dynamic),
                  person = people[0];
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.equal("soccer");
        });

        it("should infer arrays", () => {
            const people = handler.mapTo([{
                     firstName:  "David",
                     lastName:   "Beckham",
                     occupation: "soccer"
                  }], JsonFormat, Person, MapTo.dynamic),
                  person = people[0];
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.equal("soccer");
        });
        
        it("should map rooted json", () => {
            const wrapper = handler.mapTo({
                    firstName:  "David",
                    lastName:   "Beckham",
                    occupation: "soccer"
                  }, JsonFormat, PersonWrapper, MapTo.dynamic),
                  person = wrapper.person;
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.equal("soccer");            
        });

        /*
        it("should override mapping", () => {
            const override = handler.decorate({
                                 @mapsTo(Date)
                                 @format(JsonFormat)
                                 mapDateFromJson(mapTo) {
                                     return new Date(mapTo.value);
                                 }
                             }),
                  date = Mapping(override).mapTo(1481349600000, JsonFormat, Date);
            expect(date).to.be.instanceOf(Date);
            expect(+date).to.equal(+(new Date(2016,11,10)));
        });
        */

        it("should fail if type id mismatch", () => {
            expect(() => {
                handler.mapTo({
                    $type: "Doctor"
                }, JsonFormat, new Person(), MapTo.dynamic);                         
            }).to.throw(TypeError, "Expected instance of type Doctor, but received Person.");
        });
    });

    describe("#mapFrom", () => {
        it("should ignore symbols", () => {
            expect(handler.mapFrom(Symbol(), JsonFormat)).to.be.undefined;
        });

        it("should ignore functions", () => {
            expect(handler.mapFrom(function () {}, JsonFormat)).to.be.undefined;
        });
        
        it("should pass through primitives", () => {
            expect(handler.mapFrom(1, JsonFormat)).to.equal(1);
            expect(handler.mapFrom(new Number(2), JsonFormat)).to.equal(2);
            expect(handler.mapFrom(true, JsonFormat)).to.equal(true); 
            expect(handler.mapFrom(new Boolean(false), JsonFormat)).to.equal(false);           
            expect(handler.mapFrom("hello", JsonFormat)).to.equal("hello");
            expect(handler.mapFrom(String("goodbye"), JsonFormat)).to.equal("goodbye");
            // expect(handler.mapFrom(new Date(2016,11,6), JsonFormat)).to.equal("2016-12-06T06:00:00.000Z");
            expect(handler.mapFrom(/abc/, JsonFormat)).to.eql("/abc/");
        });

        it("should map to enum value", () => {
            expect(handler.mapFrom(Color.red, JsonFormat)).to.equal(1);
            expect(handler.mapFrom(Color.blue, JsonFormat)).to.equal(2);
            expect(handler.mapFrom(Color.green, JsonFormat)).to.equal(3);
        });
        
        it("should map arrays of primitives", () => {
            expect(handler.mapFrom([1,2,3], JsonFormat)).to.eql([1,2,3]);
            expect(handler.mapFrom([false,true], JsonFormat)).to.eql([false,true]);
            expect(handler.mapFrom(["one","two"], JsonFormat)).to.eql(["one","two"]);
            // expect(handler.mapFrom([new Date(2016,11,6)], JsonFormat)).to.eql(["2016-12-06T06:00:00.000Z"]);
            expect(handler.mapFrom([/abc/], JsonFormat)).to.eql(["/abc/"]);
        });
        
        it("should map all properties", () => {
            const person = new Person().extend({
                      firstName: "Christiano",
                      lastName:  "Ronaldo",
                      age:       23,
                      eyeColor:  Color.blue
                  }),
                  json = handler.mapFrom(person, JsonFormat, o =>
                      o.typeIdHandling = TypeIdHandling.Auto);
            expect(json).to.eql({
                $type:     "Person",
                firstName: "Christiano",
                lastName:  "Ronaldo",
                age:       23,
                eyeColor:  2
            });
        });

        it("should ignore some properties", () => {
            const person    = new Person();
            person.password = "1234";
            const json      = handler.mapFrom(person, JsonFormat, o =>
                o.typeIdHandling = TypeIdHandling.Auto);
            expect(json).to.eql({$type: "Person"});
        });
        
        it("should map specific properties", () => {
            const person = new Person().extend({
                      firstName: "Christiano",
                      lastName:  "Ronaldo",
                      age:       23
                  }),
                  json = handler.mapFrom(person, JsonFormat, o => {
                      o.fields         = { lastName: true };
                      o.typeIdHandling = TypeIdHandling.Auto;
                  });
            expect(json).to.eql({
                $type:    "Person",
                lastName: "Ronaldo"
            });
        });
        
        it("should map nested properties", () => {
            const doctor = new Doctor().extend({
                      firstName: "Mitchell",
                      lastName:  "Moskowitz",
                      nurse: new Person().extend({
                          firstName: "Clara",
                          lastName:  "Barton",
                          age:       36
                      }),
                      patients: [
                          new Person().extend({
                              firstName: "Lionel",
                              lastName:  "Messi",
                              age:       24
                          })
                      ]
                  });
            const json = handler.mapFrom(doctor, JsonFormat, o =>
                o.typeIdHandling = TypeIdHandling.Auto);
            expect(json).to.eql({
                $type:     "Doctor",
                firstName: "Mitchell",
                lastName:  "Moskowitz",
                nurse: {
                    firstName: "Clara",
                    lastName:  "Barton",
                    age:       36
                },
                patients: [{
                    firstName: "Lionel",
                    lastName:  "Messi",
                    age:       24
                }]
            });
        });

        it("should emit type id for TypeIdHandling.Auto", () => {
            const doctor = new Doctor().extend({
                      firstName: "Mitchell",
                      lastName:  "Moskowitz",
                      nurse: new Doctor().extend({
                          firstName: "Clara",
                          lastName:  "Barton",
                          age:       36
                      }),
                      patients: [
                          new Doctor().extend({
                              firstName: "Louis",
                              lastName:  "Pasteur",
                              age:       24
                          })
                      ]
                  });
            const json = handler.mapFrom(doctor, JsonFormat, o =>
                o.typeIdHandling = TypeIdHandling.Auto);
            expect(json).to.eql({
                $type:     "Doctor",
                firstName: "Mitchell",
                lastName:  "Moskowitz",
                nurse: {
                    $type:     "Doctor",
                    firstName: "Clara",
                    lastName:  "Barton",
                    age:       36
                },
                patients: [{
                    $type:     "Doctor",
                    firstName: "Louis",
                    lastName:  "Pasteur",
                    age:       24
                }]
            });
        });

        it("should map specific nested properties", () => {
            const doctor = new Doctor().extend({
                      firstName: "Mitchell",
                      lastName:  "Moskowitz",
                      nurse: new Person().extend({
                          firstName: "Clara",
                          lastName:  "Barton",
                          age:       36
                      }),
                      patients: [
                          new Person().extend({
                              firstName: "Lionel",
                              lastName:  "Messi",
                              age:       24
                          })
                      ]
                  });            
            const json = handler.mapFrom(doctor, JsonFormat, o => {
                o.fields = {
                    nurse: {
                        lastName:  true,
                        age:       true
                    },
                    patients: {
                        firstName: true
                    }
                };
                o.typeIdHandling = TypeIdHandling.Auto
            });
            expect(json).to.eql({
                $type: "Doctor",
                nurse: {
                    lastName: "Barton",
                    age:      36
                },
                patients: [{
                    firstName: "Lionel",
                }]
            });
        });

        it("should map rooted properties", () => {
            const wrapper = new PersonWrapper().extend({
                      firstName: "Franck",
                      lastName:  "Ribery",
                      age:       32
                  }),
                  json = handler.mapFrom(wrapper, JsonFormat);
            expect(json).to.eql({
                firstName: "Franck",
                lastName:  "Ribery",
                age:       32
            });
        });

        it("should map specific rooted properties", () => {
            const wrapper = new PersonWrapper().extend({
                      person: new Person().extend({
                          firstName: "Franck",
                          lastName:  "Ribery",
                          age:       32
                      })
                  }),
                  json = handler.mapFrom(wrapper, JsonFormat, o => {
                      o.fields = { person: { age: true } };
                      o.typeIdHandling = TypeIdHandling.Auto
                  });
            expect(json).to.eql({
                age: 32
            });
        });

        it("should emit type if for rooted properties", () => {
            const wrapper = new PersonWrapper().extend({
                      person: new Doctor().extend({
                          firstName: "William",
                          lastName:  "Harvey",
                          age:       55
                      })
                  }),
                  json = handler.mapFrom(wrapper, JsonFormat, o => {
                      o.fields = { person: { age: true } };
                      o.typeIdHandling = TypeIdHandling.Auto
                  });
            expect(json).to.eql({
                $type: "Doctor",
                age:   55
            });
        });

        it("should map arrays", () => {
            const wrappers = [new PersonWrapper().extend({
                      firstName: "Franck",
                      lastName:  "Ribery",
                      age:       32
                  })],
                  json = handler.mapFrom(wrappers, JsonFormat);
            expect(json).to.eql([{
                firstName: "Franck",
                lastName:  "Ribery",
                age:       32
            }]);
        });

        /*
        it("should override mapping", () => {
            const override = Mapping(handler.decorate({
                                 @mapFrom(Date)
                                 @format(JsonFormat)
                                 mapDateToJson(mapFrom) {
                                     return +mapFrom.object;
                                 }
                             })),
                  json = override.mapFrom(new Date(2016,11,10), JsonFormat);
            expect(json).to.equal(1481349600000);
        });
        */

        describe("@typeInfo", () => {
            it("should specify type id property", () => {
                @typeId("Dog")
                @typeInfo("@typeId")
                class Dog {}
                const json = handler.mapFrom(new Dog(), JsonFormat, o =>
                    o.typeIdHandling = TypeIdHandling.Auto);
                expect(json).to.eql({"@typeId": "Dog"});
            });

            it("should inherit type id property", () => {
                @typeInfo("@typeId")
                class Animal {}
                @typeId("Rabbit")
                class Rabbit extends Animal {}
                const json = handler.mapFrom(new Rabbit(), JsonFormat, o =>
                    o.typeIdHandling = TypeIdHandling.Auto);
                expect(json).to.eql({"@typeId": "Rabbit"});
            });

            it("should fail invalid type id property", () => {
                expect(() => {
                    @typeInfo(22)
                    class BadTypeInfo {}                            
                }).to.throw(Error, "The type id property '22' is not valid.");
            });
        });     
    });
});
