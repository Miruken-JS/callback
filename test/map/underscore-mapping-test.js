import { UnderscoreMapping } from "../../src/map/underscore-mapping";
import { expect } from "chai";

describe("UnderscoreMapping", () => {
    const hypens = new UnderscoreMapping();

    it("should map underscored names", () => {
        expect(hypens.getPropertyName(null, "firstName", false)).to.equal("first_name");
        expect(hypens.getPropertyName(null, "employeePhoneNumber", false)).to.equal("employee_phone_number");
    });
});