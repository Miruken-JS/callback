import { 
    Base, Protocol, type, conformsTo,
    $classOf
} from "miruken-core";

import {
    handles, provides, looksup, creates
} from "../src/callback-policy";

import { Command } from "../src/command";
import { Handler } from "../src/handler"
import { InferenceHandler } from "../src/inference-handler";
import { Filtering } from "../src/filters/filtering";
import { FilteredScope } from "../src/filters/filtered-scope";
import { FilterInstanceProvider } from "../src/filters/filter-instance-provider";
import { FilterOptions } from "../src/filters/filter-options";
import { 
    filter, skipFilters, createFilterSpecDecorator 
} from "../src/filters/filter";
import { FilterSpecProvider } from "../src/filters/filter-spec-provider";
import { FilterSpec } from "../src/filters/filter-spec";
import { singleton } from "../src/singleton-lifestyle";
import { initialize } from "../src/initializer";

import "../src/filters/filter-helper";

import { expect } from "chai";

class Capture extends Base {
    handled     = 0                                                                                                        
    hasComposer = false  
    filters     = []
}

class Foo extends Capture {}
class SpecialFoo extends Foo {}
class FooDecorator extends Foo {
    constructor(Foo) {}
}
class Bar extends Capture {}
class SpecialBar extends Bar {}
class Boo extends Capture {}
class Baz extends Capture {}
class SpecialBaz extends Baz {}
class Bee extends Capture {}
class Bam extends Capture {}

const Logging = Protocol.extend({
    log(msg) {}
});

@conformsTo(Logging)
@provides() class ConsoleLogger {
    log(msg) { console.log(msg); }
}
@conformsTo(Filtering)
@provides() class NullFilter {
    next(callback, { next }) {
        const capture = extractCapture(callback);
        if (capture) {
            capture.filters.push(this);
        }
        return next();
    }
}

@conformsTo(Filtering)
@provides() class LogFilter {
    get order() { return 1; }

    next(callback, @type(Logging) logger, { next, binding }) {
        const capture = extractCapture(callback);
        logger.log(`Log callback '${$classOf(callback).name}' in method ${binding.key}`);
        if (capture) {
            capture.filters.push(this);
        }
        return next();
    }
}

const logs = createFilterSpecDecorator(new FilterSpec(LogFilter));

@conformsTo(Filtering)
@provides() class ExceptionFilter {
    get order() { return 2; }

    next(callback, { next }) {
        const capture = extractCapture(callback);
        if (capture) {
            capture.filters.push(this);
        }
        const result = next();
        if (callback instanceof Boo) {
            return Promise.reject(new Error("System shutdown"));
        }
        return result;
    }   
}

const exceptions = createFilterSpecDecorator(
    new FilterSpec(ExceptionFilter, { required: true }));

@conformsTo(Filtering)
@provides() class AbortFilter {
    get order() { return 0; }

    next(callback, { next, abort }) {
        return callback.handled > 99 ? abort() : next();
    }   
}

const aborting = createFilterSpecDecorator(
    new FilterSpec(AbortFilter, { required: true }));

@conformsTo(Filtering)
@provides() class FilteringHandler extends Handler {
    get order() { return 10; }

    @handles(Bar)
    @filter(NullFilter)
    @logs @exceptions @aborting
    handleBar(bar) {
        bar.handled++;
    }

    @handles(Bee)
    @logs @skipFilters
    handleBee(bee) {
    }

    @handles()
    handleStuff(callback) {
        if (callback instanceof Bar) {
            callback.handled = -99;
        }
    }

    next(callback, { next }) {
        if (callback instanceof Bar) {
            callback.filters.push(this);
            callback.handled++;
        }
        return next();
    }
}

@provides() class SpecialFilteringHandler extends Handler {
  @handles(Foo)
    @logs @exceptions
    handleFoo(foo) {
        return new SpecialFoo();
    }

    @handles(Baz)
    @logs @exceptions
    handleBaz(baz) {
        return Promise.resolve(new SpecialBaz());
    }

    @handles(Bar)
    @logs @exceptions
    handleBar(bar) {
        return Promise.resolve(new SpecialBar());
    }

    @handles(Boo)
    @exceptions
    remove(boo) {
    }
}

@provides() @singleton() class Application {
    initialized = 0

    @initialize
    initialize1() {
        this.initialized = this.initialized + 1;
    }

    @initialize
    initialize2() {
        this.initialized = this.initialized * 10;
        return Promise.delay(10);
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
                  other  = new FilterOptions(),
                  other2 = new FilterOptions().extend({
                      skipFilters: false,
                      providers:   [provider]
                  });
            expect(other.skipFilters).to.be.undefined;
            expect(other.providers).to.be.undefined;
            options.mergeInto(other);
            expect(other.skipFilters).to.be.true;
            expect(other.providers).to.eql([provider]);
            options.mergeInto(other2);
            expect(other2.skipFilters).to.be.false;
            expect(other2.providers).to.eql([provider, provider]);
        });
    });
});

describe("FilteredScope", () => {
    const nullProvider = new FilterInstanceProvider([new NullFilter()]),
          logProvider  = new FilterInstanceProvider([new LogFilter()]);

    describe("#constructor", () => {
        it("should create no filters", () => {
            const filtered = new FilteredScope();
            expect(filtered.filters).to.eql([]);
        });

        it("should create with filters", () => {
            const filtered = new FilteredScope(nullProvider, logProvider);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });

        it("should create with filters array", () => {
            const filtered = new FilteredScope([nullProvider, logProvider]);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });        
    });

    describe("#addFilters", () => {
        it("should add no filters", () => {
            const filtered = new FilteredScope();
            filtered.addFilters();
            expect(filtered.filters).to.eql([]);
        });

        it("should add filters", () => {
            const filtered = new FilteredScope();
            filtered.addFilters(nullProvider, logProvider);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });

        it("should add filters array", () => {
            const filtered = new FilteredScope();
            filtered.addFilters([nullProvider, logProvider]);
            expect(filtered.filters).to.eql([nullProvider, logProvider]);
        });
    });

    describe("#removeFilters", () => {
        it("should remove filters", () => {
            const filtered = new FilteredScope(nullProvider, logProvider);
            filtered.removeFilters(nullProvider);
            expect(filtered.filters).to.eql([logProvider]);
        });

        it("should remove filters array", () => {
            const filtered = new FilteredScope(nullProvider, logProvider);
            filtered.removeFilters([nullProvider, logProvider]);
            expect(filtered.filters).to.eql([]);
        });        
    });

    describe("#removeAllFilters", () => {
        it("should remove filters", () => {
            const filtered = new FilteredScope(nullProvider, logProvider);
            filtered.removeAllFilters();
            expect(filtered.filters).to.eql([]);
        });     
    });
});

describe("Filter", () => {
    let handler;
    beforeEach(() => {
        handler = new InferenceHandler(
            FilteringHandler, SpecialFilteringHandler,
            LogFilter, ConsoleLogger, ExceptionFilter,
            AbortFilter, NullFilter);
    });

    it("should create filters", () => {
        const bar = new Bar();
        expect(handler.handle(bar)).to.be.true;
        expect(bar.handled).to.equal(2);
        expect(bar.filters.length).to.equal(4);
        const filters = bar.filters;
        expect(filters[0]).to.be.instanceOf(LogFilter);
        expect(filters[1]).to.be.instanceOf(ExceptionFilter);
        expect(filters[2]).to.be.instanceOf(FilteringHandler);
        expect(filters[3]).to.be.instanceOf(NullFilter);
    });

    it("should create filters for base2 class", () => {
        const bar                   = new Bar(),
              FilteringBase2Handler = Handler.extend(Filtering, {
                  @provides
                  constructor() {
                  },

                  get order() { return 10; },

                  @handles(Bar)
                  @filter(NullFilter)
                  @logs @exceptions @aborting
                  handleBar(bar) {
                      bar.handled++;
                  },

                  next(callback, { next }) {
                      if (callback instanceof Bar) {
                          callback.filters.push(this);
                          callback.handled++;
                      }
                      return next();
                  }
              }),
              handler = new InferenceHandler(
                 FilteringBase2Handler, LogFilter,
                 ConsoleLogger, ExceptionFilter,
                 AbortFilter, NullFilter);
        expect(handler.handle(bar)).to.be.true;
        expect(bar.handled).to.equal(2);
        expect(bar.filters.length).to.equal(4);
        const filters = bar.filters;
        expect(filters[0]).to.be.instanceOf(LogFilter);
        expect(filters[1]).to.be.instanceOf(ExceptionFilter);
        expect(filters[2]).to.be.instanceOf(FilteringBase2Handler);
        expect(filters[3]).to.be.instanceOf(NullFilter);
    });

    it("should abort pipeline", () => {
        const bar = new Bar().extend({ handled: 100 });
        expect(handler.handle(bar)).to.be.true;
        expect(bar.handled).to.equal(-99);
    });

    it("should skip filters", () => {
        const bee = new Bee();
        expect(handler.handle(bee)).to.be.true;
        expect(bee.filters.length).to.equal(0);
    });

    it("shouldfilters", () => {
        const bar = new Bar();
        expect(handler.skipFilters().handle(bar)).to.be.true;
        expect(bar.handled).to.equal(2);
        expect(bar.filters.length).to.equal(2);
        const filters = bar.filters;
        expect(filters[0]).to.be.instanceOf(ExceptionFilter);
        expect(filters[1]).to.be.instanceOf(FilteringHandler);
    });

    it("should propagate rejected filter promise", done => {
        const boo = new Boo();
        handler.command(boo).catch(error => {
            expect(error.message).to.equal("System shutdown");
            done();
        });
    });

    it("should reject filter if missing dependencies", () => {
        const bar        = new Bar(),
              BadHandler = @provides class {
                  @logs
                  handleBar(bar) {}
              };
        handler = new InferenceHandler(BadHandler, LogFilter);
        expect(handler.handle(bar)).to.be.false;
    });  
});

describe("SingletonLifestyle", () => {
  let handler;
    beforeEach(() => {
        handler = new InferenceHandler(Application);
    });

    it("should create singleton instances", async () => {
        const app = await handler.resolve(Application);
        expect(app).to.be.instanceOf(Application);
        expect(app).to.equal(await handler.resolve(Application));
    });

    it("should create singleton base2 instances", () => {
        const Application2 = Base.extend({
                  @provides @singleton
                  constructor() {
                  }
              }),
              handler = new InferenceHandler(Application2),
              app     = handler.resolve(Application2);
        expect(app).to.be.instanceOf(Application2);
        expect(app).to.equal(handler.resolve(Application2));
    });    
});

describe("Initializer", () => {
  let handler;
    beforeEach(() => {
        handler = new InferenceHandler(Application);
    });

    it("should initialize singleton instances", async () => {
        const app = await handler.resolve(Application);
        expect(app).to.be.instanceOf(Application);
        expect(app).to.equal(await handler.resolve(Application));
        expect(app.initialized).to.equal(10);
    });

    it("should initialize singleton base2 instances", async () => {
        const Application2 = Base.extend({
                  @provides @singleton
                  constructor() {
                  },
                  
                  initialized: 0,

                  @initialize
                  initialize1() {
                      this.initialized = this.initialized + 1;
                  },

                  @initialize
                  initialize2() {
                      this.initialized = this.initialized * 10;
                          return Promise.delay(10);
                  }
              }),
              handler = new InferenceHandler(Application2),
              app     = await handler.resolve(Application2);
        expect(app).to.be.instanceOf(Application2);
        expect(app).to.equal(await handler.resolve(Application2));
        expect(app.initialized).to.equal(10);
    });

    it("should fail if calling initializer directly", () => {
        expect(() => {
            new Application().initialize1();
        }).to.throw(Error, "An @initialize method cannot be called directly."); 
    });   
});

function extractCapture(callback) {
    if (callback instanceof Capture) return callback;
    if (callback instanceof Command) {
        const cb = callback.callback;
        if (cb instanceof Capture) return cb;
    }
}
