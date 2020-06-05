import { Base } from "miruken-core";
import Filtering from "../src/filters/filtering";
import FilterInstanceProvider from "../src/filters/filter-instance-provider";
import { FilterOptions } from "../src/filters/filter-options";
import FilteredObject from "../src/filters/filtered-object";

import { expect } from "chai";

const NullFilter = Base.extend(Filtering, {
    next(callback, rawCallback, binding, composer, next, provider) {
        return next();
    }
});

const LogFilter = Base.extend(Filtering, {
    next(callback, rawCallback, binding, composer, next, provider) {
        console.log(binding.key);
        return next();
    }
});

describe("FilterOptions", () => {
    describe("mergeInto", () => {
        it("should merge filter options", () => {
            const filter   = new NullFilter(),
                  provider = new FilterInstanceProvider([filter]),
                  options  = new FilterOptions({
                      skipFilters: true,
                      providers:   [provider]
                  }),
                  other = new FilterOptions();
            expect(other.skipFilters).to.be.undefined;
            expect(other.providers).to.be.undefined;
            options.mergeInto(other);
            expect(other.skipFilters).to.be.true;
            expect(other.providers).to.eql([provider]);
        });
    });
});

describe("FilteredObject", () => {
    const nullProvider = new FilterInstanceProvider([new NullFilter()]),
          logProvider  = new FilterInstanceProvider([new LogFilter()]);

    describe("#constructor", () => {
        it("should create no filters", () => {
            const filtered = new FilteredObject();
            expect(filtered.filters).to.eql([]);
        });

        it("should create with filters", () => {
            const filtered = new FilteredObject(nullProvider, logProvider);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });

        it("should create with filters array", () => {
            const filtered = new FilteredObject([nullProvider, logProvider]);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });        
    });

    describe("#addFilters", () => {
        it("should add no filters", () => {
            const filtered = new FilteredObject();
            filtered.addFilters();
            expect(filtered.filters).to.eql([]);
        });

        it("should add filters", () => {
            const filtered = new FilteredObject();
            filtered.addFilters(nullProvider, logProvider);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });

        it("should add filters array", () => {
            const filtered = new FilteredObject();
            filtered.addFilters([nullProvider, logProvider]);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });
    });

    describe("#removeFilters", () => {
        it("should remove filters", () => {
            const filtered = new FilteredObject(nullProvider, logProvider);
            filtered.removeFilters(nullProvider);
            expect(filtered.filters).to.eql([logProvider]);
        });

        it("should remove filters array", () => {
            const filtered = new FilteredObject(nullProvider, logProvider);
            filtered.removeFilters([nullProvider, logProvider]);
            expect(filtered.filters).to.eql([]);
        });        
    });

    describe("#removeAllFilters", () => {
        it("should remove filters", () => {
            const filtered = new FilteredObject(nullProvider, logProvider);
            filtered.removeAllFilters();
            expect(filtered.filters).to.eql([]);
        });     
    });
});