import { hyphenNaming } from "../../src/map/hyphen-naming";
import { expect } from "chai";

describe("HyphenNaming", () => {
    const hyphens = new (@hyphenNaming class {});

    it("should map hyphened names", () => {
        expect(hyphens.getPropertyName(null, "firstName", false)).to.equal("first-name");
        expect(hyphens.getPropertyName(null, "employeePhoneNumber", false)).to.equal("employee-phone-number");
    });
});