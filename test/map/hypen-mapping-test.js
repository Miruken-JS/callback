import { HypenMapping } from "../../src/map/hypen-mapping";
import { expect } from "chai";

describe("HypenMapping", () => {
    const hypens = new HypenMapping();

    it("should map hypened names", () => {
        expect(hypens.getPropertyName(null, "firstName", false)).to.equal("first-name");
        expect(hypens.getPropertyName(null, "employeePhoneNumber", false)).to.equal("employee-phone-number");
    });
});