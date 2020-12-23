import {
    Base, Enum, Either, design,
    $isPlainObject, createKeyChain 
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
    TypeIdHandling, typeId, typeInfo
} from "../../src/api/type-id";

import { expect } from "chai";
import { hyphenNaming } from "../../src/map/hyphen-naming";
import { unmanaged } from "../../src/unmanaged";

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
    let handler, hyphenMapping;
    
    beforeEach(() => {
        handler = new HandlerBuilder()
            .addTypes(from => from.types(JsonMapping))
            .build();
        hyphenMapping = new (@hyphenNaming class {});
    });
    
    describe("#mapTo", () => {
        it("should map from json", () => {
            const person = handler.$mapTo({
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

        it("should map from json using content-type", () => {
            const person = handler.$mapTo({
                firstName:  "David",
                lastName:   "Beckham",
                eyeColor:   2,
                occupation: "soccer"
            }, "application/json; charset=utf-8", Person);
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.eyeColor).to.equal(Color.blue);
            expect(person.occupation).to.be.undefined;
        });

        it("should ignore from json", () => {
            const person = handler.$mapTo({
                password: "1234"
            }, JsonFormat, Person);
            expect(person).to.be.instanceOf(Person);
            expect(person.password).to.be.undefined;
        });
        
        it("should pass through primitives", () => {
            expect(handler.$mapTo(1, JsonFormat)).to.equal(1);
            expect(handler.$mapTo(2, JsonFormat)).to.equal(2);
            expect(handler.$mapTo(true, JsonFormat)).to.equal(true); 
            expect(handler.$mapTo(false, JsonFormat)).to.equal(false);           
            expect(handler.$mapTo("hello", JsonFormat)).to.equal("hello");
            expect(handler.$mapTo("goodbye", JsonFormat)).to.equal("goodbye");
        });

        it("should map enum value", () => {
            expect(handler.$mapTo(1, JsonFormat, Color)).to.equal(Color.red);
            expect(handler.$mapTo(2, JsonFormat, Color)).to.equal(Color.blue);
            expect(handler.$mapTo(3, JsonFormat, Color)).to.equal(Color.green);
            expect(() => {
                expect(handler.$mapTo(4, JsonFormat, Color)).to.equal(Color.green);                            
            }).to.throw(TypeError, "4 is not a valid value for this Enum");
        });
        
        it("should map Either primitive value", () => {
            const either1 = handler.$mapTo({
                isLeft: false,
                value:  "Hello"
            }, JsonFormat, Either);
            expect(either1).to.be.instanceOf(Either.Right);
            expect(either1.value).to.equal("Hello");

            const either2 = handler.$mapTo({
                isLeft: false,
                value:  null
            }, JsonFormat, Either);
            expect(either2).to.be.instanceOf(Either.Right);
            expect(either2.value).to.be.null;

            const either3 = handler.$mapTo({
                isLeft: true,
                value:  22
            }, JsonFormat, Either);
            expect(either3).to.be.instanceOf(Either.Left);
            expect(either3.value).to.equal(22);       
        });

        it("should map all from json", () => {
            const person = handler.$mapTo({
                firstName:  "David",
                lastName:   "Beckham",
                occupation: "soccer"
            }, JsonFormat, Person);
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.be.undefined;
        });

        it("should use type id to parse json", () => {
            const person = handler.$mapTo({
                $type:      "Doctor",
                firstName:  "Daniel",
                lastName:   "Worrell",
                occupation: "Orthopedic"
            }, JsonFormat, Person);
            expect(person).to.be.instanceOf(Doctor);
            expect(person.firstName).to.equal("Daniel");
            expect(person.lastName).to.equal("Worrell");
            expect(person.occupation).to.be.undefined;
        });

        it("should map all related from json", () => {
            const doctor = handler.$mapTo({
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
            }, JsonFormat, Doctor);
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
            const doctor = handler.$mapTo({
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
            }, JsonFormat, Doctor);
            expect(doctor).to.be.instanceOf(Doctor);
            expect(doctor.firstName).to.equal("Mitchell");
            expect(doctor.lastName).to.equal("Moskowitz");
            expect(doctor.hobbies).to.eql(["golf", "cooking", "reading"]);
            expect(doctor.nurse).to.be.instanceOf(Doctor);
            expect(doctor.nurse.firstName).to.equal("Clara");
            expect(doctor.nurse.lastName).to.equal("Barton");
            expect(doctor.nurse.occupation).to.be.undefined;
            expect(doctor.nurse.age).to.equal(36);
            expect(doctor.patients[0]).to.be.instanceOf(Doctor);
            expect(doctor.patients[0].firstName).to.equal("Louis");
            expect(doctor.patients[0].lastName).to.equal("Pasteur");
            expect(doctor.patients[0].occupation).to.be.undefined;
            expect(doctor.patients[0].age).to.equal(75);
        });

        it("should map arrays", () => {
            const people = handler.$mapTo([{
                     firstName:  "David",
                     lastName:   "Beckham",
                     occupation: "soccer"
                  }], JsonFormat, [Person]),
                  person = people[0];
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.be.undefined;
        });

        it("should infer arrays", () => {
            const people = handler.$mapTo([{
                     firstName:  "David",
                     lastName:   "Beckham",
                     occupation: "soccer"
                  }], JsonFormat, Person),
                  person = people[0];
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.be.undefined;
        });
        
        it("should map rooted json", () => {
            const wrapper = handler.$mapTo({
                    firstName:  "David",
                    lastName:   "Beckham",
                    occupation: "soccer"
                  }, JsonFormat, PersonWrapper),
                  person = wrapper.person;
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.be.undefined;           
        });

        it("should override mapping", () => {
            const override = handler.decorate({
                                 @mapsTo(Date)
                                 @format(JsonFormat)
                                 mapDateFromJson(mapTo) {
                                     return new Date(mapTo.value);
                                 }
                             }),
                  date = override.$mapTo(1481349600000, JsonFormat, Date);
            expect(date).to.be.instanceOf(Date);
            expect(+date).to.equal(+(new Date(2016,11,10)));
        });

        it("should map all from json using strategy", () => {
            const person = handler
                .$mapStrategy(hyphenMapping)
                .$mapTo({
                    "first-name":  "David",
                    "last-name":   "Beckham",
                    "occupation": "soccer"
                }, JsonFormat, Person);
            expect(person).to.be.instanceOf(Person);
            expect(person.firstName).to.equal("David");
            expect(person.lastName).to.equal("Beckham");
            expect(person.occupation).to.be.undefined;
        });

        it("should use raw json if no type info", () => {
            class Message {
                payload;
            }
            const message = handler.$mapTo({
                payload: {
                    upc: "197212",
                    quantity: 4
                }
            }, JsonFormat, Message);
            expect(message).to.be.instanceOf(Message);
            expect($isPlainObject(message.payload)).to.be.true;
            expect(message.payload).to.eql({
                upc: "197212",
                quantity: 4
            })
        });

        it("should map Either complex value", () => {
            const either1 = handler.$mapTo({
                isLeft: false,
                value:  {
                    $type:     "Person",
                    firstName: "Christiano",
                    lastName:  "Ronaldo",
                    age:       23,
                    eyeColor:  2
                }
            }, JsonFormat, Either);
            expect(either1).to.be.instanceOf(Either.Right);
            expect(either1.value).to.be.instanceOf(Person);
         
            const either2 = handler.$mapTo({
                isLeft: false,
                value:  {
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
                }
            }, JsonFormat, Either);
            expect(either2).to.be.instanceOf(Either.Right);   
            expect(either2.value).to.be.instanceOf(Doctor);  
        });

        it("should fail if Enum instance given", () => {
            expect(() => {
                handler.$mapTo(3, JsonFormat, Color.red);                           
            }).to.throw(Error, "Enum is immutable and cannot be mapped onto.");
        });

        it("should fail if type id could not be resolved", () => {
            expect(() => {
                handler.$mapTo({
                    $type: "Accountant"
                }, JsonFormat, new Person());                         
            }).to.throw(TypeError, "The type with id 'Accountant' could not be resolved.");
        });

        it("should fail if type id mismatch", () => {
            expect(() => {
                handler.$mapTo({
                    $type: "Doctor"
                }, JsonFormat, new Person());                         
            }).to.throw(TypeError, "Expected instance of type 'Doctor', but received 'Person'.");
        });

        it("should fail if no type information.", () => {
            expect(() => {
                handler.$mapTo({
                    firstName: "Christiano",
                    lastName:  "Ronaldo",
                    age:       23,
                    eyeColor:  2
                }, JsonFormat);
             }).to.throw(TypeError, "The type was not specified and could not be inferred from '$type'.");    
         });
    });

    describe("#mapFrom", () => {
        it("should ignore symbols", () => {
            expect(handler.$mapFrom(Symbol(), JsonFormat)).to.be.undefined;
        });

        it("should ignore functions", () => {
            expect(handler.$mapFrom(function () {}, JsonFormat)).to.be.undefined;
        });
        
        it("should pass through primitives", () => {
            expect(handler.$mapFrom(1, JsonFormat)).to.equal(1);
            expect(handler.$mapFrom(new Number(2), JsonFormat)).to.equal(2);
            expect(handler.$mapFrom(true, JsonFormat)).to.equal(true); 
            expect(handler.$mapFrom(new Boolean(false), JsonFormat)).to.equal(false);           
            expect(handler.$mapFrom("hello", JsonFormat)).to.equal("hello");
            expect(handler.$mapFrom(String("goodbye"), JsonFormat)).to.equal("goodbye");
            // expect(handler.$mapFrom(new Date(2016,11,6), JsonFormat)).to.equal("2016-12-06T06:00:00.000Z");
            expect(handler.$mapFrom(/abc/, JsonFormat)).to.eql("/abc/");
        });

        it("should map to enum value", () => {
            expect(handler.$mapFrom(Color.red, JsonFormat)).to.equal(1);
            expect(handler.$mapFrom(Color.blue, JsonFormat)).to.equal(2);
            expect(handler.$mapFrom(Color.green, JsonFormat)).to.equal(3);
        });
        
        it("should map to Either primitive value", () => {
            const json1 = handler.$mapFrom(Either.right("Hello"), JsonFormat);
            expect(json1).to.eql({
                isLeft: false,
                value:  "Hello"
            });

            const json2 = handler.$mapFrom(Either.right(), JsonFormat);
            expect(json2).to.eql({
                isLeft: false,
                value:  null
            });

            const json3 = handler.$mapFrom(Either.left(22), JsonFormat);
            expect(json3).to.eql({
                isLeft: true,
                value:  22
            });            
        });

        it("should map to Either complex value", () => {
            const person = new Person().extend({
                firstName: "Christiano",
                lastName:  "Ronaldo",
                age:       23,
                eyeColor:  Color.blue
            });
            const json1 = handler
                .$mapTypeIdHandling(TypeIdHandling.Auto)
                .$mapFrom(Either.right(person), JsonFormat);
            expect(json1).to.eql({
                isLeft: false,
                value:  {
                    $type:     "Person",
                    firstName: "Christiano",
                    lastName:  "Ronaldo",
                    age:       23,
                    eyeColor:  2
                }
            });
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

            const json2 = handler
                .$mapTypeIdHandling(TypeIdHandling.Auto)
                .$mapFrom(Either.left(doctor), JsonFormat);
            expect(json2).to.eql({
                isLeft: true,
                value:  {
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
                }
            });        
        });

        it("should map arrays of primitives", () => {
            expect(handler.$mapFrom([1,2,3], JsonFormat)).to.eql([1,2,3]);
            expect(handler.$mapFrom([false,true], JsonFormat)).to.eql([false,true]);
            expect(handler.$mapFrom(["one","two"], JsonFormat)).to.eql(["one","two"]);
            // expect(handler.$mapFrom([new Date(2016,11,6)], JsonFormat)).to.eql(["2016-12-06T06:00:00.000Z"]);
            expect(handler.$mapFrom([/abc/], JsonFormat)).to.eql(["/abc/"]);
        });
        
        it("should map all properties", () => {
            const person = new Person().extend({
                      firstName: "Christiano",
                      lastName:  "Ronaldo",
                      age:       23,
                      eyeColor:  Color.blue
                  }),
                  json = handler
                    .$mapTypeIdHandling(TypeIdHandling.Auto)
                    .$mapFrom(person, JsonFormat);
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
            const json      = handler
                .$mapTypeIdHandling(TypeIdHandling.Auto)
                .$mapFrom(person, JsonFormat);
            expect(json).to.eql({$type: "Person"});
        });
        
        it("should map specific properties", () => {
            const person = new Person().extend({
                      firstName: "Christiano",
                      lastName:  "Ronaldo",
                      age:       23
                  }),
                  json = handler
                    .$mapOptions({
                        fields: { lastName: true },
                        typeIdHandling: TypeIdHandling.Auto
                    })
                    .$mapFrom(person, JsonFormat);
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
            const json = handler
                .$mapTypeIdHandling(TypeIdHandling.Auto)
                .$mapFrom(doctor, JsonFormat);
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
            const json = handler
                .$mapTypeIdHandling(TypeIdHandling.Auto)
                .$mapFrom(doctor, JsonFormat);
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
            const json = handler
                .$mapOptions({
                    fields: {
                        nurse: {
                            lastName:  true,
                            age:       true
                        },
                        patients: {
                            firstName: true
                        }
                    },
                    typeIdHandling: TypeIdHandling.Auto
                })
                .$mapFrom(doctor, JsonFormat);
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
                  json = handler.$mapFrom(wrapper, JsonFormat);
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
                  json = handler
                      .$mapOptions({
                          fields: { person: { age: true } },
                          typeIdHandling: TypeIdHandling.Auto
                      })
                      .$mapFrom(wrapper, JsonFormat);
            expect(json).to.eql({
                age: 32
            });
        });

        it("should emit type id for rooted properties", () => {
            const wrapper = new PersonWrapper().extend({
                      person: new Doctor().extend({
                          firstName: "William",
                          lastName:  "Harvey",
                          age:       55
                      })
                  }),
                  json = handler
                      .$mapOptions({
                          fields: { person: { age: true } },
                          typeIdHandling: TypeIdHandling.Auto
                      })
                      .$mapFrom(wrapper, JsonFormat);
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
                  json = handler.$mapFrom(wrappers, JsonFormat);
            expect(json).to.eql([{
                firstName: "Franck",
                lastName:  "Ribery",
                age:       32
            }]);
        });

        it("should override mapping", () => {
            const override = handler.decorate({
                        @mapsFrom(Date)
                        @format(JsonFormat)
                        mapDateToJson(mapFrom) {
                            return +mapFrom.object;
                        }
                    }),
                  json = override.$mapFrom(new Date(2016,11,10), JsonFormat);
            expect(json).to.be.a("number");
        });

        it("should map anonymous object", () => {
            const person = {
                firstName: "Christiano",
                lastName:  "Ronaldo",
                age:       23,
                eyeColor:  Color.blue
            };
            const json = handler.$mapFrom(person, JsonFormat);
            expect(json).to.eql({
                firstName: "Christiano",
                lastName:  "Ronaldo",
                age:       23,
                eyeColor:  2
            });
        });

        it("should map all properties using strategy", () => {
            const person = new Person().extend({
                      firstName: "Christiano",
                      lastName:  "Ronaldo",
                      age:       23,
                      eyeColor:  Color.blue
                  }),
                  json = handler
                      .$mapOptions({
                          typeIdHandling: TypeIdHandling.Auto,
                          strategy: hyphenMapping
                      })
                      .$mapFrom(person, JsonFormat);
            expect(json).to.eql({
                "$type":      "Person",
                "first-name": "Christiano",
                "last-name":  "Ronaldo",
                "age":        23,
                "eye-color":  2
            });
        });

        describe("@typeInfo", () => {
            it("should specify type id property", () => {
                @typeId("Dog")
                @typeInfo("@typeId")
                class Dog {}
                const json = handler
                    .$mapTypeIdHandling(TypeIdHandling.Auto)
                    .$mapFrom(new Dog(), JsonFormat);
                expect(json).to.eql({"@typeId": "Dog"});
            });

            it("should inherit type id property", () => {
                @typeInfo("@typeId")
                class Animal {}
                @typeId("Rabbit")
                class Rabbit extends Animal {}
                const json = handler
                    .$mapTypeIdHandling(TypeIdHandling.Auto)
                    .$mapFrom(new Rabbit(), JsonFormat);
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
