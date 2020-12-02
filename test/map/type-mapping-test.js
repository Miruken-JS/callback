import { Base } from "miruken-core";
import { Request } from "../../src/api/request";
import { NotHandledError } from "../../src/errors";
import { format } from "../../src/map/maps";
import { 
    TypeMapping, TypeIdFormat, typeId
} from "../../src/map/type-mapping";

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
        return `Oneway:${typeId.get(this.request)}`;
    }
}

describe("typeId", () => {
    it("should set class type id", () => {
        expect(typeId.get(GetDetails)).to.equal("GetDetails");
        expect(typeId.get(new GetDetails())).to.equal("GetDetails");
    });

    it("should set class type id on base2 class", () => {
        const Foo = Base.extend(typeId("Foo"));
        expect(typeId.get(Foo)).to.equal("Foo");
        expect(typeId.get(new Foo())).to.equal("Foo");
    });

    it("should normalize type id", () => {
        expect(typeId.get(CreateDetails)).to.equal("CreateDetails");
        expect(typeId.get(new CreateDetails())).to.equal("CreateDetails");
    });

    it("should use class name if missing type id", () => {
        @typeId() class Bar {}
        expect(typeId.get(Bar)).to.equal("Bar");
        expect(typeId.get(new Bar())).to.equal("Bar");
    });

    it("should use class name if empty type id", () => {
        @typeId("") class Bar {}
        expect(typeId.get(Bar)).to.equal("Bar");
        expect(typeId.get(new Bar())).to.equal("Bar");
    });

    it("should set method type id", () => {
        expect(typeId.get(Oneway)).to.be.undefined;
        expect(typeId.get(new Oneway(new GetDetails()))).to.equal("Oneway:GetDetails");
        expect(new Oneway(new GetDetails()).typeId).to.equal("Oneway:GetDetails");
    });

    it("should inherit class type id", () => {
        expect(typeId.get(CreateDetails2)).to.equal("CreateDetails");
        expect(typeId.get(new CreateDetails2())).to.equal("CreateDetails");
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
        expect(typeId.get(Bar.prototype)).to.equal("foo");
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
            typeId.get(new Bar());
        }).to.throw(Error, "@typeId getter 'typeId' returned invalid identifier 22.");
    });
});

describe("TypeMapping", () => {
    let handler;
    beforeEach(() => {
        handler = new TypeMapping();
    });

    describe("#mapTo", () => {
        it("should map type id to Type", () => {
            const type = handler.mapTo("GetDetails", TypeIdFormat);
            expect(type).to.equal(GetDetails);
        });

        it("should ignore whitespace in type id", () => {
            const type = handler.mapTo("CreateDetails", TypeIdFormat);
            expect(type).to.equal(CreateDetails);
        });

        it("should map type id to Type using helper", () => {
            const type = handler.getTypeFromId(" Create Details");
            expect(type).to.equal(CreateDetails);
        });
        
        it("should not map type id to Type if missing", () => {
            expect(() => {
                handler.mapTo("UpdateDetails", TypeIdFormat);
            }).to.throw(NotHandledError, "UpdateDetails not handled");
        });

        it("should fail if type id not passed to helper", () => {
            expect(() => {
                handler.getTypeFromId({});                
            }).to.throw(Error, /Invalid type id/);  
        });        
    });
});
