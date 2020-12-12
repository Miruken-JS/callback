import { Base } from "miruken-core";
import { Request } from "../../src/api/request";
import { NotHandledError } from "../../src/errors";
import { format } from "../../src/map/maps";
import { typeId } from "../../src/api/type-id";

import "../../src/map/handler-map";

import { expect } from "chai";

@typeId("GetDetails")
class GetDetails extends Request {
    id = undefined
}

@typeId(" Create Details ")
class CreateDetails extends Request {
    id = undefined
}

class UpdateDetails {
    id      = undefined
    details = undefined
}

class CreateDetails2 extends CreateDetails {
    data = undefined
}

class Oneway {
    constructor(request) {
        this.request = request;
    }
    @typeId
    get typeId() {
        return `Oneway:${typeId.getId(this.request)}`;
    }
}

class Oneway2 extends Oneway {
    get typeId() {
        return `Oneway2:${typeId.getId(this.request)}`;
    }
}

describe("typeId", () => {
    describe("#getId", () => {
        it("should set class type id", () => {
            expect(typeId.getId(GetDetails)).to.equal("GetDetails");
            expect(typeId.getId(new GetDetails())).to.equal("GetDetails");
        });

        it("should set class type id on base2 class", () => {
            const Foo = Base.extend(typeId("Foo"));
            expect(typeId.getId(Foo)).to.equal("Foo");
            expect(typeId.getId(new Foo())).to.equal("Foo");
        });

        it("should normalize type id", () => {
            expect(typeId.getId(CreateDetails)).to.equal("CreateDetails");
            expect(typeId.getId(new CreateDetails())).to.equal("CreateDetails");
        });

        it("should use class name if missing type id", () => {
            @typeId() class Bar {}
            expect(typeId.getId(Bar)).to.equal("Bar");
            expect(typeId.getId(new Bar())).to.equal("Bar");
        });

        it("should use class name if empty type id", () => {
            @typeId("") class Bar {}
            expect(typeId.getId(Bar)).to.equal("Bar");
            expect(typeId.getId(new Bar())).to.equal("Bar");
        });

        it("should get type id from method", () => {
            expect(typeId.getId(Oneway)).to.be.undefined;
            expect(typeId.getId(new Oneway(new GetDetails()))).to.equal("Oneway:GetDetails");
            expect(new Oneway(new GetDetails()).typeId).to.equal("Oneway:GetDetails");
        });

        it("should inherit get type id from method", () => {
            expect(typeId.getId(Oneway2)).to.be.undefined;
            expect(typeId.getId(new Oneway2(new GetDetails()))).to.equal("Oneway2:GetDetails");
            expect(new Oneway2(new GetDetails()).typeId).to.equal("Oneway2:GetDetails");
        });

        it("should not inherit class type id", () => {
            expect(typeId.getId(CreateDetails2)).to.be.undefined;
            expect(typeId.getId(new CreateDetails2())).to.be.undefined;
        });

        it("should fail if type id is not a string", () => {
            expect(() => {
                @typeId(22) class Bar {}
            }).to.throw(SyntaxError, "@typeId expects a string identifier.");
        });

        it("should fail to infer type id from base2 class", () => {
            expect(() => {
                Base.extend(typeId());
            }).to.throw(Error, "@typeId cannot be inferred from a base2 class.  Please specify it explicitly.");
        });

        it("should fail if @typeId applied to a method", () => {
            class Bar {
                @typeId
                foo() { return "foo"; }
            }
            expect(typeId.getId(Bar.prototype)).to.equal("foo");
        });

        it("should fail if @typeId applied to a setter", () => {
            expect(() => {
                class Bar {
                    @typeId
                    set foo(value) {}
                }
            }).to.throw(Error, "@typeId can only be applied to classes, getters or methods.");
        });

        it("should fail if dynamic type id is not a string", () => {
            class Bar {
                @typeId
                get typeId() { return 22; } 
            }
            expect(() => {
                typeId.getId(new Bar());
            }).to.throw(Error, "@typeId getter 'typeId' returned invalid identifier 22.");
        });
    });

    describe("#getType", () => {
        it("should map type id to Type", () => {
            const type = typeId.getType("GetDetails");
            expect(type).to.equal(GetDetails);
        });

        it("should ignore whitespace in type id", () => {
            const type = typeId.getType("CreateDetails");
            expect(type).to.equal(CreateDetails);
        });

        it("should map type id to Type using helper", () => {
            const type = typeId.getType(" Create Details");
            expect(type).to.equal(CreateDetails);
        });
        
        it("should not map type id to Type if missing", () => {
            const type = typeId.getType("UpdateDetails");
            expect(type).to.be.undefined;
        });

        it("should fail if type id not passed to helper", () => {
            expect(() => {
                typeId.getType({});                
            }).to.throw(Error, /Invalid type id/);  
        });        
    });
});
