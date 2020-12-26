import { underscoreNaming } from "../../../src/map/strategy/underscore-naming";
import { expect } from "chai";

describe("UnderscoreNaming", () => {
    const underscore = new (@underscoreNaming class {});

    it("should map underscored names", () => {
        expect(underscore.getPropertyName(null, "firstName", false)).to.equal("first_name");
        expect(underscore.getPropertyName(null, "employeePhoneNumber", false)).to.equal("employee_phone_number");
    });
});