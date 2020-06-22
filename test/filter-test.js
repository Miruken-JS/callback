import { 
    Base, type, conformsTo, $classOf
} from "miruken-core";

import {
    handles, provides, looksup, creates
} from "../src/callback-policy";

import Command from "../src/command";
import Handler from "../src/handler"
import StaticHandler from "../src/static-handler";
import InferenceHandler from "../src/inference-handler";
import Filtering from "../src/filters/filtering";
import FilteredObject from "../src/filters/filtered-object";
import FilterInstanceProvider from "../src/filters/filter-instance-provider";
import FilterOptions from "../src/filters/filter-options";
import { filter, createFilteSpecDecorator } from "../src/filters/filter";
import "../src/filters/filter-helper";

import { expect } from "chai";
import FilterSpecProvider from "../src/filters/filter-spec-provider";
import FilterSpec from "../src/filters/filter-spec";

class Capture {
    handled     = 0                                                                                                        
    hasComposer = false  
    filters     = []
}

class Bar extends Capture {}

@conformsTo(Filtering)
@provides() class NullFilter {
    next(callback, binding, composer, next, provider) {
        return next();
    }
}

@conformsTo(Filtering)
@provides() class LogFilter {
    get order() { return 1; }

    next(callback, binding, composer, next, provider) {
        const capture = extractCapture(callback);
        console.log(`Log callback '${$classOf(callback).name}' in method ${binding.key}`);
        if (capture) {
            capture.filters.push(this);
            ++capture.handled;
        }
        return next();
    }
}

const log = createFilteSpecDecorator(new FilterSpec(LogFilter));

@conformsTo(Filtering)
@provides() class FilteringHandler extends Handler {
    @handles @log
    handleBar(@type(Bar) bar) {
        bar.handled++;
    }

    next(callback, binding, composer, next, provider) {
        const capture = extractCapture(callback);
        if (capture) {
            capture.filters.push(this);
        }
        return next();
    }
}

describe("FilterOptions", () => {
    describe("mergeInto", () => {
        it("should merge filter options", () => {
            const filter   = new NullFilter(),
                  provider = new FilterInstanceProvider([filter]),
                  options  = new FilterOptions().extend({
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

describe("Filter", () => {
     it("should create filters", () => {
        const bar     = new Bar(),
              handler = new StaticHandler(FilteringHandler, LogFilter)
                .chain(new InferenceHandler(FilteringHandler));
        expect(handler.handle(bar)).to.be.true;
        expect(bar.handled).to.equal(2);
        expect(bar.filters.length).to.equal(2);
        expect(bar.filters.some(f => f instanceof FilteringHandler)).to.be.true;
        expect(bar.filters.some(f => f instanceof LogFilter)).to.be.true;
     });
});

function extractCapture(callback) {
    if (callback instanceof Capture) return callback;
    if (callback instanceof Command) {
        const cb = callback.callback;
        if (cb instanceof Capture) return cb;
    }
}
