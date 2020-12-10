import {
    True, False, Undefined, Base, Protocol,
    DuckTyping, Variance, MethodType,
    TypeInfo, assignID, design, returns, type,
    conformsTo, copy, $isPromise, $eq, $eval,
    $optional, $instant, $lazy, $using, $flatten,
    createKeyChain
} from "miruken-core";

import { Handler, $composer } from "../src/handler";
import { CascadeHandler } from "../src/cascade-handler";
import { CompositeHandler } from "../src/composite-handler";
import { InferenceHandler } from "../src/inference-handler";
import { HandleMethod } from "../src/handle-method";
import { Batching } from "../src/batch";
import { Options, options } from "../src/options";
import { Binding } from "../src/binding/binding";

import {
    CallbackPolicy, handles, provides,
    looksup, creates, $unhandled
} from "../src/callback-policy";

import { HandlerDescriptor } from "../src/handler-descriptor";

import {
    RejectedError, TimeoutError, NotHandledError
} from "../src/errors";

import { KeyResolver } from "../src/key-resolver";
import { proxy } from "../src/proxy";
import { unmanaged } from "../src/unmanaged";
import { handlesOptions } from "../src/handler-options";

import "../src/handler-helper";
import "../src/handler-protocol";
import "../src/handler-batch";

import { expect } from "chai";

const _ = createKeyChain();

export class Guest {
    constructor(age) {
        this.age = age;
    }
}

export class Dealer {
    shuffle(cards) {
        return cards.sort(() => 0.5 - Math.random());
    }
}

export class PitBoss {
    constructor(name) {
        this.name = name;
    }
}

export class DrinkServer {}

export const Game = Protocol.extend({
    open(numPlayers) {}
});

export const Security = Protocol.extend({
    admit(guest) {},
    trackActivity(activity) {},
    scan() {}
});

@conformsTo(Security)
export class Level1Security {
    admit(guest) {
        return guest.age >= 21;
    }
}

@conformsTo(Security)
export class Level2Security {
    trackActivity(activity) {
        console.log(`Tracking '${activity.name}'`);
    }

    scan() {
        return Promise.delay(2).then(True);
    }
}

export class WireMoney {
    constructor(requested) {
        this.requested = requested;
    }
}

export class CountMoney {
    constructor() {
        _(this).total = 0.0;
    }

    get total() { return _(this).total; }
    record(amount) { _(this).total += amount; }
}

export class Accountable {
    constructor(assets, liabilities) {
        _(this).assets      = Number(assets || 0);
        _(this).liabilities = Number(liabilities || 0);
    }

    get assets()      { return _(this).assets; }
    get liabilities() { return _(this).liabilities; }
    get balance()     { return this.assets - this.liabilities; }
    
    addAssets(amount) {
        _(this).assets = _(this).assets + amount;
    }

    addLiabilities(amount) {
        _(this).liabilities = _(this).liabilities + amount;
    }

    transfer(amount, receiver) {
        let { assets, liabilties } = _(this);
        assets -= amount;
        if (assets < 0) {
            _(this).liabilties = (liabilties -= assets);
            _(this).assets     = 0;
        } else {
            _(this).assets = assets;
        }
        if (receiver) {
            receiver.addAssets(amount);
        }
        return Promise.delay(100);
    }

    @handles(CountMoney)
    countMoney(countMoney, { composer }) {
        countMoney.record(this.balance);        
    }
}

export class Cashier extends Accountable {
    @handles(WireMoney)
    wireMoney(wireMoney) {
        const amount = wireMoney.requested;
        if (amount > this.assets) {
            throw Error(`Cashier has insufficient funds. $${this.assets.toFixed(2)} < $${amount.toFixed(2)}`);
        }
        this.transfer(amount);
        wireMoney.received = wireMoney.requested;
        return Promise.resolve(wireMoney);        
    }

    toString() { return "Cashier $" + this.balance; }
}

export class Activity extends Accountable {
    constructor(name) {
        super();
        this.name = name;
    }

    toString() { return "Activity " + this.name; }
}

@conformsTo(Game)
export class CardTable extends Activity {
    constructor(name, minPlayers, maxPlayers) {
        super(name);
        _(this).minPlayers = minPlayers;
        _(this).maxPlayers = maxPlayers;
    }

    open(numPlayers) {
        const { minPlayers, maxPlayers } = _(this);
        if (minPlayers > numPlayers || numPlayers > maxPlayers)
            return $unhandled;
    }    
}

export class Casino extends CompositeHandler {
    constructor(name) {
        super();
        this.name = name;
    }

    @provides(PitBoss)
    pitBoss() { return new PitBoss("Freddy"); }

    @provides(DrinkServer)
    drinkServer() {
        return Promise.delay(100).then(() => new DrinkServer());
    }

    toString() { return "Casino " + this.name; }
}

describe("TypeInfo", () => {
    describe("#merge", () => {
        it("should merge key resolver", () => {
            const typeInfo = new TypeInfo(Activity),
                  otherTypeInfo = new TypeInfo().extend({
                      keyResolver: new KeyResolver()
                  });
            expect(typeInfo.keyResolver).to.be.undefined;
            typeInfo.merge(otherTypeInfo);
            expect(typeInfo.keyResolver).to.equal(otherTypeInfo.keyResolver);
        });
    });
});

describe("HandleMethod", () => {
    describe("#type", () => {
        it("should get the method type", () => {
            const method = new HandleMethod(MethodType.Invoke, undefined, "deal", [[1,3,8], 2]);
            expect(method.methodType).to.equal(MethodType.Invoke);
        });
    });

    describe("#methodName", () => {
        it("should get the method name", () => {
            const method = new HandleMethod(MethodType.Invoke, undefined, "deal", [[1,3,8], 2]);
            expect(method.methodName).to.equal("deal");
        });
    });

    describe("#methodArgs", () => {
        it("should get the method arguments", () => {
            const method = new HandleMethod(MethodType.Invoke, undefined, "deal", [[1,3,8], 2]);
            expect(method.args).to.eql([[1,3,8], 2]);
        });

        it("should be able to change arguments", () => {
            const method = new HandleMethod(MethodType.Invoke, undefined, "deal", [[1,3,8], 2]);
            method.args[0] = [2,4,8];
            expect(method.args).to.eql([[2,4,8], 2]);
        });
    });

    describe("#returnValue", () => {
        it("should get the return value", () => {
            const method = new HandleMethod(MethodType.Invoke, undefined, "deal", [[1,3,8], 2]);
            method.returnValue = [1,8];
            expect(method.returnValue).to.eql([1,8]);
        });

        it("should set the return value", () => {
            const method = new HandleMethod(MethodType.Invoke, undefined, "deal", [[1,3,8], 2]);
            method.returnValue = [1,8];
            expect(method.returnValue).to.eql([1,8]);
        });        
    });

    describe("#invokeOn", () => {
        it("should invoke method on target", () => {
            const dealer  = new Dealer(),
                  method  = new HandleMethod(MethodType.Invoke, undefined, "shuffle", [[22,19,9,14,29]]),
                  handled = method.invokeOn(dealer);
            expect(handled).to.be.true;
            expect(method.returnValue).to.have.members([22,19,9,14,29]);
        });

        it("should call getter on target", () => {
            const guest   = new Guest(12),
                  method  = new HandleMethod(MethodType.Get, undefined, "age"),
                  handled = method.invokeOn(guest);
            expect(handled).to.be.true;
            expect(method.returnValue).to.equal(12);
        });

        it("should call setter on target", () => {
            const guest   = new Guest(12),
                  method  = new HandleMethod(MethodType.Set, undefined, "age", 18),
                  handled = method.invokeOn(guest);
            expect(handled).to.be.true;
            expect(method.returnValue).to.equal(18);
            expect(guest.age).to.equal(18);
        });
    });
});

describe("Policies", () => {
    describe("CallbackPolicy", () => {
        it("should define callbacks on base2 classes", () => {
            const Cashier = Base.extend({
                      @handles(CountMoney)
                      countMoney(countMoney, { composer }) {
                          countMoney.record(200);
                      }
                  }),
                  countMoney = new CountMoney(),
                  wireMoney  = new WireMoney(75),
                  cashier    = Handler.for(new Cashier());
            Cashier.implement({
                @handles(WireMoney)
                wireMoney(wireMoney) {
                    wireMoney.received = wireMoney.requested;     
                }
            });                  
            expect(cashier.handle(countMoney)).to.be.true;
            expect(cashier.handle(wireMoney)).to.be.true;
            expect(countMoney.total).to.equal(200);
            expect(wireMoney.received).to.equal(75);
        });

        it("should define callbacks on base2 extended real classes", () => {
            const Cashier = class extends Handler {
                      @handles(CountMoney)
                      countMoney(countMoney, { composer }) {
                          countMoney.record(200);
                      }
                  },
                  countMoney = new CountMoney(),
                  wireMoney  = new WireMoney(75),
                  cashier    = new Cashier();
            Cashier.implement({
                @handles(WireMoney)
                wireMoney(wireMoney) {
                    wireMoney.received = wireMoney.requested;     
                }
            });                  
            expect(cashier.handle(countMoney)).to.be.true;
            expect(cashier.handle(wireMoney)).to.be.true;
            expect(countMoney.total).to.equal(200);
            expect(wireMoney.received).to.equal(75);
        });

        it("should define callbacks on real classes", () => {
            class Cashier {
                @handles(CountMoney)
                countMoney(countMoney, { composer }) {
                    countMoney.record(10);
                }
            }
            const countMoney = new CountMoney();
            expect(Handler.for(new Cashier()).handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(10);
        });

        it("should define callbacks on base2 static members", () => {
            const Cashier = Base.extend(null, {
                      @handles(CountMoney)
                      countMoney(countMoney, { composer }) {
                          countMoney.record(1000);
                      }
                  }),
                  countMoney = new CountMoney();
            const handler = Handler.for(Cashier);
            expect(handler.handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(1000);
        });

        it("should infer callbacks on base2 static members", () => {
            const Cashier = Base.extend(null, {
                      @handles(CountMoney)
                      countMoney(countMoney, { composer }) {
                          countMoney.record(1000);
                      }
                  }),
                  countMoney = new CountMoney();
            expect(new InferenceHandler(Cashier).handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(1000);
        });

        it("should define callbacks on static class members", () => {
            class Cashier {
                @handles(CountMoney)
                static countMoney(countMoney, { composer }) {
                    countMoney.record(3500);
                }
            }
            const countMoney = new CountMoney();
            expect(Handler.for(Cashier).handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(3500);
        });

        it("should infer callbacks on static class members", () => {
            class Cashier {
                @handles(CountMoney)
                static countMoney(countMoney, { composer }) {
                    countMoney.record(3500);
                }
            }
            const countMoney = new CountMoney();
            expect(new InferenceHandler(Cashier).handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(3500);
        });

        it("should fallback to the first design argument for Contravarient policies", () => {
            class Cashier extends Handler {
                @handles
                @design(CountMoney)
                countMoney(countMoney, { composer }) {
                    countMoney.record(150);
                }
            }
            const countMoney = new CountMoney();
            expect(new Cashier().handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(150);
        });

        it("should fallback to the design return type for Covariant policies", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (class extends Handler {
                      @provides
                      @returns(Cashier) cashier() { return cashier; }
                  });
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });

        it("Should fail instantiation of CallbackPolicy", () => {
            expect(() => {
                new CallbackPolicy(Variance.Contravariant, "bam");
            }).to.throw(Error, "CallbackPolicy cannot be instantiated.  Use CovariantPolicy, ContravariantPolicy, or InvariantPolicy.");
        });
    });

    describe("Bindings", () => {
        it("should fail instantiating a Binding", () => {
            expect(() => {
                new Binding();
            }).to.throw(Error, "Binding cannot be instantiated.  Use Binding.create().");     
        });

        it("should create 'handles' when first handler registered", () => {
            const handler  = new Handler();
            handles.addHandler(handler, True, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings(handles.policy);
            expect(bindings).to.be.ok;
        });

        it("should maintain list of handler bindings", () => {
            const handler = new Handler();
            handles.addHandler(handler, Activity, Undefined);
            handles.addHandler(handler, Accountable, Undefined);
            handles.addHandler(handler, Game, Undefined);
            const descriptor  = HandlerDescriptor.get(handler),
                  bindings    = descriptor.getBindings(handles.policy),
                  constraints = [...bindings].map(x => x.constraint);
            expect(constraints).to.eql([Activity, Accountable, Game]);
        });

        it("should order 'handles' contravariantly", () => {
            const handler = new Handler();
            handles.addHandler(handler, Accountable, Undefined);
            handles.addHandler(handler, Activity, Undefined);
            const descriptor  = HandlerDescriptor.get(handler),
                  bindings    = descriptor.getBindings(handles.policy),
                  constraints = [...bindings].map(x => x.constraint);
            expect(constraints).to.eql([Activity, Accountable]);
        });

        it("should order 'handles' invariantly", () => {
            const handler = new Handler();
            handles.addHandler(handler, Activity, Undefined);
            handles.addHandler(handler, Activity, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings(handles.policy),
                  handlers   = [...bindings].map(x => x.handler);
            expect(handlers).to.eql([Undefined, True]);
        });

        it("should order 'provides' covariantly", () => {
            const handler = new Handler();
            provides.addHandler(handler, Activity, Undefined);
            provides.addHandler(handler, Accountable, Undefined);
            const descriptor  = HandlerDescriptor.get(handler),
                  bindings    = descriptor.getBindings(provides.policy),
                  constraints = [...bindings].map(x => x.constraint);
            expect(constraints).to.eql([Accountable, Activity]);
        });

        it("should order 'provides' invariantly", () => {
            const handler = new Handler();
            provides.addHandler(handler, Activity, Undefined);
            provides.addHandler(handler, Activity, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings(provides.policy),
                  handlers   = [...bindings].map(x => x.handler);
            expect(handlers).to.eql([Undefined, True]);
        });

        it("should order 'looksup' invariantly", () => {
            const handler = new Handler();
            looksup.addHandler(handler, Activity, Undefined);
            looksup.addHandler(handler, Activity, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings(looksup.policy),
                  handlers   = [...bindings].map(x => x.handler);
            expect(handlers).to.eql([Undefined, True]);
        });

        it("should call function when handler removed", () => {
            let handler        = new Handler,
                handlerRemoved = false,
                unregister     = handles.addHandler(
                    handler, True, Undefined, null, () => {
                    handlerRemoved = true;
                });
            unregister();
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings(handles.policy); 
            expect(handlerRemoved).to.be.true;
            expect(bindings).to.be.undefined;
        });

        it("should suppress handler removed if requested", () => {
            let handler        = new Handler,
                handlerRemoved = false,
                unregister     = handles
                    .addHandler(handler, True, Undefined, () => {
                    handlerRemoved = true;
                });
            unregister(false);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings(handles.policy);             
            expect(handlerRemoved).to.be.false;
            expect(bindings).to.be.undefined;
        });

        it("should remove 'handles' when no handlers remain", () => {
            const handler    = new Handler,
                  unregister = handles.addHandler(handler, True, Undefined);
            unregister();
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings(handles.policy); 
            expect(bindings).to.be.undefined;
        });

        describe("#index", () => {
            it("should index class constraints using assignID", () => {
                const handler = new Handler,
                    index     = assignID(Activity);
                handles.addHandler(handler, Activity, Undefined);
                const descriptor = HandlerDescriptor.get(handler),
                    bindings   = descriptor.getBindings(handles.policy); 
                expect(bindings.getFirst(index).constraint).to.equal(Activity);
            });

            it("should index protocol constraints using assignID", () => {
                const handler   = new Handler,
                    index     = assignID(Game);
                handles.addHandler(handler, Game, Undefined);
                const descriptor = HandlerDescriptor.get(handler),
                    bindings   = descriptor.getBindings(handles.policy); 
                expect(bindings.getFirst(index).constraint).to.equal(Game);
            });

            it("should index string constraints using string", () => {
                const handler   = new Handler();
                handles.addHandler(handler, "something", Undefined);
                const descriptor = HandlerDescriptor.get(handler),
                    bindings   = descriptor.getBindings(handles.policy); 
                expect(bindings.getFirst("something").handler).to.equal(Undefined);
            });

            it("should move index to next match", () => {
                let handler     = new Handler,
                    index       = assignID(Activity),
                    unregister  = handles.addHandler(handler, Activity, Undefined);
                handles.addHandler(handler, Activity, True);
                const descriptor = HandlerDescriptor.get(handler),
                    bindings   = descriptor.getBindings(handles.policy); 
                expect(bindings.getFirst(index).handler).to.equal(Undefined);
                unregister();
                expect(bindings.getFirst(index).handler).to.equal(True);
            });

            it("should remove index when no more matches", () => {
                const handler   = new Handler,
                    index     = assignID(Activity);
                handles.addHandler(handler, Accountable, Undefined);
                const unregister = handles.addHandler(handler, Activity, Undefined);
                unregister();
                const descriptor = HandlerDescriptor.get(handler),
                    bindings   = descriptor.getBindings(handles.policy); 
                expect(bindings.getFirst(index)).to.be.undefined;
            });
        });

        describe("#removeAll", () => {
            it("should remove all 'handles' definitions", () => {
                let handler     = new Handler,
                    removeCount = 0,
                    removed     = () => { ++removeCount; };
                handles.addHandler(handler, Accountable, Undefined, null, removed);
                handles.addHandler(handler, Activity, Undefined, null, removed);
                const descriptor = HandlerDescriptor.get(handler);
                descriptor.removeBindings(handles.policy);
                expect(removeCount).to.equal(2);
                expect(descriptor.getBindings(handles.policy)).to.be.undefined;
            });

            it("should remove all 'provides' definitions", () => {
                let handler     = new Handler,
                    removeCount = 0,
                    removed     = () => { ++removeCount; };
                provides.addHandler(handler, Activity, Undefined, null, removed);
                provides.addHandler(handler, Accountable, Undefined, null, removed);
                const descriptor = HandlerDescriptor.get(handler);
                descriptor.removeBindings(provides.policy);
                expect(removeCount).to.equal(2);
                expect(descriptor.getBindings(provides.policy)).to.be.undefined;
            });
        });
    });
});

describe("Options", () => {
    class MyOptions extends Options {
        ack;
        log;
        child;
    }

    describe("#copy", () => {
        it("should copy options", () => {
            const options     = new MyOptions()
                .extend({ack: true, log: true}),
                  optionsCopy = options.copy();
            expect(optionsCopy).to.not.equal(options);
            expect(optionsCopy.ack).to.be.true;
            expect(optionsCopy.log).to.be.true;
            expect(optionsCopy.child).to.be.undefined;
        });

        it("should copy nested Options", () => {
            const options = new MyOptions().extend({
                      ack:   true,
                      log:   true,
                      child: new MyOptions().extend({ack: true})
                  }),
                  optionsCopy = options.copy();
            expect(optionsCopy).to.not.equal(options);
            expect(optionsCopy.ack).to.be.true;
            expect(optionsCopy.log).to.be.true;
            expect(optionsCopy.child).to.not.equal(options.child);
            expect(optionsCopy.child.ack).to.be.true;
            expect(optionsCopy.child.log).to.be.undefined;
            expect(optionsCopy.child.child).to.be.undefined;            
        });        
    });

    describe("#mergeInto", () => {
        it("should merge options", () => {
            const options1 = new MyOptions().extend({
                      ack:   true,
                      log:   true,
                      child: new MyOptions().extend({ack: true})                
                  }),
                  options2 = new MyOptions().extend({log: false});
            options1.mergeInto(options2);
            expect(options2.ack).to.be.true;
            expect(options2.log).to.be.false;
            expect(options2.child).to.not.equal(options1.child);
            expect(options2.child.ack).to.be.true;
            expect(options2.child.log).to.be.undefined;            
        });

        it("should merge nested options", () => {
            const options1 = new MyOptions().extend({
                      ack:   true,
                      log:   true,
                      child: new MyOptions({ack: true})
                  }),
                  options2 = new MyOptions().extend({
                      log:   false,
                      child: new MyOptions().extend({
                          ack: false,
                          log: true
                      })
                  });
            options1.mergeInto(options2);
            expect(options2.ack).to.be.true;
            expect(options2.log).to.be.false;
            expect(options2.child).to.not.equal(options1.child);
            expect(options2.child.ack).to.be.false;
            expect(options2.child.log).to.be.true;            
        });        
    });
});

describe("Handler", () => {
    describe("#handle", () => {
        it("should not handle nothing", () => {
            const casino   = new Casino();
            expect(casino.handle()).to.be.false;
            expect(casino.handle(null)).to.be.false;
        });

        it("should not handle anonymous objects", () => {
            const casino   = new Casino();
            expect(casino.handle({name:"Joe"})).to.be.false;
        });

        it("should handle callbacks", () => {
            const cashier    = Handler.for(new Cashier(1000000.00)),
                  countMoney = new CountMoney();
            expect(cashier.handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(1000000.00);
        });

        it("should handle callback chain", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(casino.handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(1000000.00);
        });

        it("should handle callbacks per instance", () => {
            const cashier    = new Cashier(1000000.00),
                  handler    = new Handler();
            handles.addHandler(handler, Cashier, function (cashier) {
                this.cashier = cashier;
            });
            expect(handler.handle(cashier)).to.be.true;
            expect(handler.cashier).to.equal(cashier);
        });

        it("should handle callbacks per instance with extend", () => {
            const cashier    = new Cashier(1000000.00),
                  handler    = (new Handler()).extend({
                      @handles(Cashier)
                      account(cashier) {
                          this.cashier = cashier;                          
                      }
                  });
            expect(handler.handle(cashier)).to.be.true;
            expect(handler.cashier).to.equal(cashier);
        });

        it("should handle callbacks with extension", () => {
            const cashier    = new Cashier(1000000.00),
                  wireMoney  = new WireMoney(100),
                  handler    = new ((class extends Handler {
                    @handles(WireMoney)
                    wireMoney(wireMoney) {
                        wireMoney.received = wireMoney.requested + .50;       
                    }
                  }).implement({
                      @handles(Cashier)
                      account(cashier) {
                          this.cashier = cashier;                          
                      }                      
                  }));
            expect(handler.handle(wireMoney)).to.be.true;
            expect(wireMoney.received).to.equal(100.50);
            expect(handler.handle(cashier)).to.be.true;
            expect(handler.cashier).to.equal(cashier);
        });

        it("should handle callback hierarchy", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (class extends Handler {
                      @handles(Accountable)
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  });
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
        });

        it("should ignore callback if $unhandled", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (class extends Handler {
                      @handles(Cashier)
                      ignore(cashier) { return $unhandled; }
                  });
            expect(inventory.handle(cashier)).to.be.false;
        });

        it("should handle callback invariantly", () => {
            const cashier     = new Cashier(1000000.00),
                  accountable = new Accountable(1.00),
                  inventory   = new (class extends Handler {
                      @handles($eq(Accountable))
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  });
            expect(inventory.handle(cashier)).to.be.false;
            expect(inventory.handle(accountable)).to.be.true;
            expect(inventory.accountable).to.equal(accountable);
            handles.addHandler(inventory, Accountable, function (accountable) {
                this.accountable = accountable;
            });
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
        });
        
        it("should stop early if handle callback invariantly", () => {
            const cashier     = new Cashier(1000000.00),
                  accountable = new Accountable(1.00),
                  inventory   = new (class extends Handler {
                      @handles(Accountable)
                      ignore(accountable) {}

                      @handles
                      everything(callback) {}
                  });
            expect(inventory.handle($eq(accountable))).to.be.true;
            expect(inventory.handle($eq(cashier))).to.be.false;
        });
        
        it("should handle callback protocol conformance", () => {
            const blackjack  = new CardTable("Blackjack"),
                  inventory  = new (class extends Handler {
                      @handles(Game)
                      play(game) {
                          this.game = game;
                      }
                  });
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.game).to.equal(blackjack);
        });

        it("should prefer callback hierarchy over protocol conformance", () => {
            const blackjack  = new CardTable("Blackjack"),
                  inventory  = new (class extends Handler {
                      @handles(Activity)
                      activity(activity) {
                          this.activity = activity;
                      }

                      @handles(Game)
                      play(game) {
                          this.game = game;
                      }                      
                  });
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.activity).to.equal(blackjack);
            expect(inventory.game).to.be.undefined;
        });

        it("should prefer callback hierarchy and continue with protocol conformance", () => {
            const blackjack  = new CardTable("Blackjack"),
                  inventory  = new (class extends Handler {
                      @handles(Activity)
                      activity(activity) {
                          this.activity = activity;
                          return $unhandled;
                      }

                      @handles(Game)
                      play(game) {
                          this.game = game;
                      }                      
                  });
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.activity).to.equal(blackjack);
            expect(inventory.game).to.equal(blackjack);
        });

        it("should handle unknown callback", () => {
            const blackjack = new CardTable("Blackjack"),
                  inventory = new (class extends Handler {
                      @handles
                      everything(callback) {
                          callback.check = true;
                      }
                  });
            expect(inventory.handle(blackjack)).to.be.true;
            expect(blackjack.check).to.be.true;
        });

        it("should handle unknown callback via delegate", () => {
            const blackjack = new CardTable("Blackjack"),
                  inventory = new (class {
                      @handles
                      everything(callback) {
                          callback.check = true;
                      }
                  }),
                  casino   = new Casino("Belagio").addHandlers(inventory);
            expect(casino.handle(blackjack)).to.be.true;
            expect(blackjack.check).to.be.true;
        });

        it("should allow handlers to chain to base", () => {
            const blackjack = new CardTable("Blackjack"),
                  Tagger    = class extends Handler {
                      @handles(Activity)
                      activity(activity) {
                          activity.tagged++;
                      }
                  },
                  inventory  = new (class extends Tagger {
                      activity(activity) {
                          activity.tagged++;                          
                          super.activity(activity);
                      }
                  });
            blackjack.tagged = 0;
            expect(inventory.handle(blackjack)).to.be.true;
            expect(blackjack.tagged).to.equal(2);
        });

        it("should handle callbacks with precedence rules", () => {
            let matched   = -1,
                Checkers  = @conformsTo(Game) class {},
                inventory = new (class extends Handler {
                    @handles($eval(c => c === PitBoss))
                    pitBoss() { matched = 0; }

                    @handles
                    anything() { matched = 1; }

                    @handles(Game)
                    game() { matched = 2; }

                    @handles(Security)
                    security() { matched = 3; }

                    @handles(Activity)
                    activity() { matched = 5; }

                    @handles(Accountable)
                    accountable() { matched = 4; }

                    @handles(CardTable)
                    cardTable() { matched = 6; }
                });
            inventory.handle(new CardTable("3 Card Poker"));
            expect(matched).to.equal(6);
            inventory.handle(new Activity("Video Poker"));
            expect(matched).to.equal(5);
            inventory.handle(new Cashier(100));
            expect(matched).to.equal(4);
            inventory.handle(new Level1Security);
            expect(matched).to.equal(3);
            inventory.handle(new Checkers);
            expect(matched).to.equal(2);
            inventory.handle(new Casino("Paris"));
            expect(matched).to.equal(1);
            inventory.handle(new PitBoss("Mike"));
            expect(matched).to.equal(0);
        });

        it("should handle callbacks greedy", () => {
            const cashier   = new Cashier(1000000.00),
                  blackjack = new Activity("Blackjack"),
                  casino    = new Casino("Belagio")
                     .addHandlers(cashier, blackjack),
                  countMoney = new CountMoney();
            cashier.transfer(50000, blackjack)

            expect(blackjack.balance).to.equal(50000);
            expect(cashier.balance).to.equal(950000);
            expect(casino.handle(countMoney, true)).to.be.true;
            expect(countMoney.total).to.equal(1000000.00);
        });

        it("should handle callbacks anonymously", () => {
            const countMoney = new CountMoney(),
                  handler    = Handler.accepting(countMoney => {
                      countMoney.record(50);
                  }, CountMoney);
            expect(handler.handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(50);
        });

        it("should handle compound keys", () => {
            const cashier   = new Cashier(1000000.00),
                  blackjack = new Activity("Blackjack"),
                  bank      = new (class extends Accountable {}),
                  inventory = new (class extends Handler {
                      @handles(Cashier, Activity)
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  });
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.accountable).to.equal(blackjack);
            expect(inventory.handle(bank)).to.be.false;
        });

        it("should unregister compound keys", () => {
            const cashier    = new Cashier(1000000.00),
                  blackjack  = new Activity("Blackjack"),
                  bank       = new (class extends Accountable {}),
                  inventory  = new Handler,
                  unregister = handles.addHandler(inventory, [Cashier, Activity],
                      function (accountable) {
                          this.accountable = accountable;
                      });
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.accountable).to.equal(blackjack);
            expect(inventory.handle(bank)).to.be.false;
            unregister();
            expect(inventory.handle(cashier)).to.be.false;
            expect(inventory.handle(blackjack)).to.be.false;
        });

        it("should handle callbacks with dependencies", () => {
            const Bank = class extends Accountable {
                      @provides(Cashier)
                      cashier() { return new Cashier(); }

                      @handles
                      @design(WireMoney, Cashier)
                      wireMoney(wireMoney, cashier) {
                          this.transfer(this.balance, cashier);
                          cashier.wireMoney(wireMoney);
                          cashier.transfer(cashier.balance, this);
                      }
                  },
                  bank = new Bank(10000, 3500);
            expect(Handler.for(bank).handle(new WireMoney(75))).to.be.true;
            expect(bank.assets).to.equal(9925);
            expect(bank.liabilities).to.equal(3500);
            expect(bank.balance).to.equal(6425);
        });

        it("should handle callbacks with dependencies static", () => {
            const Safe = class {
                      @provides(Cashier)
                      static cashier() { return new Cashier(2000); }

                      @handles
                      @design(CountMoney, Cashier)
                      static countMoney(countMoney, cashier) {
                          countMoney.record(cashier.balance);
                      }
                  },
                  countMoney = new CountMoney();
            expect(Handler.for(Safe).handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(2000);
        });

        it("should handle callbacks with promise dependencies", done => {
            const Bank = class extends Accountable {
                      @provides(Cashier)
                      cashier() { 
                          return Promise.resolve(new Cashier());
                      }

                      @handles
                      @design(WireMoney, Cashier)
                      wireMoney(wireMoney, cashier) {
                          this.transfer(this.balance, cashier);
                          cashier.wireMoney(wireMoney);
                          cashier.transfer(cashier.balance, this);
                      }
                  },
                  bank = new Bank(10000, 3500);
            Handler.for(bank).command(new WireMoney(75)).then(() => {
                expect(bank.assets).to.equal(9925);
                expect(bank.liabilities).to.equal(3500);
                expect(bank.balance).to.equal(6425);
                done();
            });
        });

        it("should handle callbacks with promise dependencies async", async () => {
            const Bank = class extends Accountable {
                      @provides(Cashier)
                      cashier() { 
                          return Promise.resolve(new Cashier());
                      }

                      @handles
                      @design(WireMoney, Cashier)
                      wireMoney(wireMoney, cashier) {
                          this.transfer(this.balance, cashier);
                          cashier.wireMoney(wireMoney);
                          cashier.transfer(cashier.balance, this);
                      }
                  },
                  bank = new Bank(10000, 3500);
            await Handler.for(bank).command(new WireMoney(75));
            expect(bank.assets).to.equal(9925);
            expect(bank.liabilities).to.equal(3500);
            expect(bank.balance).to.equal(6425);
        });

        it("should handle callbacks with array dependencies", () => {
            const Bank = class extends Accountable {
                      @provides(Cashier)
                      cashier() { 
                          return [new Cashier(1000), new Cashier()];
                      }

                      @handles
                      @design(WireMoney, [Cashier])
                      wireMoney(wireMoney, cashiers) {
                          expect(cashiers.length).to.equal(2);
                          const cashier = cashiers[0];
                          this.transfer(this.balance, cashier);
                          cashier.wireMoney(wireMoney);
                          cashier.transfer(cashier.balance, this);
                      }
                  },
                  bank = new Bank(10000, 3500);
            expect(Handler.for(bank).handle(new WireMoney(75))).to.be.true;
            expect(bank.assets).to.equal(10925);
            expect(bank.liabilities).to.equal(3500);
            expect(bank.balance).to.equal(7425);
        });

        it("should handle callbacks with lazy dependencies", () => {
            const Bank = class extends Accountable {
                      @provides(Cashier)
                      cashier() { return new Cashier(); }

                      @handles
                      @design(WireMoney, $lazy(Cashier))
                      wireMoney(wireMoney, getCashier) {
                          const cashier = getCashier();
                          this.transfer(this.balance, cashier);
                          cashier.wireMoney(wireMoney);
                          cashier.transfer(cashier.balance, this);
                      }
                  },
                  bank = new Bank(10000, 3500);
            expect(Handler.for(bank).handle(new WireMoney(75))).to.be.true;
            expect(bank.assets).to.equal(9925);
            expect(bank.liabilities).to.equal(3500);
            expect(bank.balance).to.equal(6425);
        });

        it("should handle optional callback dependencies", () => {
            const Bank = class extends Accountable {
                      @handles
                      @design(WireMoney, $optional(Cashier))
                      wireMoney(wireMoney, cashier) {
                          expect(cashier).to.be.undefined;
                      }
                  },
                  bank = new Bank(10000, 3500);
            expect(Handler.for(bank).handle(new WireMoney(75))).to.be.true;
        });

        it("should handle callbacks with proxy dependencies", () => {
            const Supervisor = Protocol.extend({
                      approve(transaction) {}
                  }),
                  BankManager = @conformsTo(Supervisor) class {
                      approve(transaction) {
                          if (transaction instanceof WireMoney) {
                              return transaction.requested < 5000;
                          }
                          return false;
                      }
                  },
                  Bank = class extends Accountable {
                      @handles(WireMoney)
                      wireMoney(wireMoney, @proxy(Supervisor) supervisor) {
                          supervisor.approve(wireMoney);
                          this.transfer(wireMoney.requested);
                      }
                  },
                  bank    = new Bank(10000),
                  handler = Handler.for(bank).$chain(new BankManager());
            expect(handler.handle(new WireMoney(1000))).to.be.true;
            expect(bank.assets).to.equal(9000);
            expect(bank.balance).to.equal(9000);
        });

        it("should fail if dependencies unresolved", () => {
            const Bank = class extends Accountable {
                      @handles
                      @design(WireMoney, Cashier)
                      wireMoney(wireMoney, cashier) { }
                  },
                  bank = new Bank(10000, 3500);
            expect(Handler.for(bank).handle(new WireMoney(75))).to.be.false;
        });

        it("should fail promise dependency unresolved", done => {
            const Bank = class extends Accountable {
                      @provides(Cashier)
                      cashier() { return Promise.resolve(); }

                      @handles
                      @design(WireMoney, Cashier)
                      wireMoney(wireMoney, cashier) { }
                  },
                  bank = new Bank(10000, 3500);
            Handler.for(bank).command(new WireMoney(75)).catch(err => {
                done();
            });
        });

        it("should fail rejected promise dependency", done => {
            const Bank = class extends Accountable {
                      @provides(Cashier)
                      cashier() { 
                          return Promise.reject(new Error("This is bad!!"));
                      }

                      @handles
                      @design(WireMoney, Cashier)
                      wireMoney(wireMoney, cashier) { }
                  },
                  bank = new Bank(10000, 3500);
            Handler.for(bank).command(new WireMoney(75)).catch(err => {
                done();
            });
        });

        it("should infer callbacks", () => {
            const countMoney = new CountMoney(),
                  inventory  = new (class extends Handler {
                      @provides(Cashier)
                      cashier() { return new Cashier(750); }
                  }),
                  handler    = new Casino("Paris")
                    .addHandlers(inventory, new InferenceHandler(Cashier));
            expect(handler.handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(750);
        });

        it("should infer promise callbacks", done => {
            const countMoney = new CountMoney(),
                  inventory  = new (class extends Handler {
                      @provides(Cashier)
                      cashier() { 
                          return Promise.resolve(new Cashier(750));
                      }
                  }),
                  handler    = new Casino("Paris")
                    .addHandlers(inventory, new InferenceHandler(Cashier));
            Promise.resolve(handler.command(countMoney)).then(result => {
                expect(countMoney.total).to.equal(750);
                done();
            });
        });

        it("should fail to infer callbacks", () => {
            const countMoney = new CountMoney(),
                  handler    = new InferenceHandler(Cashier);
            expect(handler.handle(countMoney)).to.be.false;
        });

        it("should fail to infer promise callbacks", done => {
            const countMoney = new CountMoney(),
                  inventory  = new (class extends Handler {
                      @provides(Cashier)
                      cashier() { 
                          return Promise.reject(new Error("Cashier is sick"));
                      }
                  }),
                  handler    = new Casino("Paris")
                    .addHandlers(inventory, new InferenceHandler(Cashier));
            Promise.resolve(handler.command(countMoney)).catch(error => {
                expect(error).to.be.instanceOf(NotHandledError);
                expect(error.callback).to.equal(countMoney);
                done();
            });
        });        
    })

    describe("#command", () => {
        it("should handle objects eventually", done => {
            const cashier   = new Cashier(750000.00),
                  casino    = new Casino("Venetian").addHandlers(cashier),
                  wireMoney = new WireMoney(250000);
            Promise.resolve(casino.command(wireMoney)).then(result => {
                expect(result).to.equal(wireMoney);
                expect(wireMoney.received).to.equal(250000);
                done();
            });
        });

        it("should handle objects eventually with promise", done => {
            const bank = new (class extends Handler {
                        @handles(WireMoney)
                        wireMoney(wireMoney) {
                            wireMoney.received = 50000;
                            return Promise.delay(100).then(() => wireMoney);
                        }
                  }),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.command(wireMoney)).then(result => {
                expect(result).to.equal(wireMoney);
                expect(wireMoney.received).to.equal(50000);
                done();
            });
        });

        it("should handle callbacks anonymously with promise", done => {
            const handler = Handler.accepting(
                    countMoney => countMoney.record(50), CountMoney),
                  countMoney = new CountMoney();
            Promise.resolve(handler.command(countMoney)).then(() => {
                expect(countMoney.total).to.equal(50);
                done();
            });
        });
    });

    describe("#resolve", () => {
        it("should resolve explicit objects", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (class extends Handler {
                      @provides(Cashier)
                      cashier() { return cashier; }
                  });
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });
        
        it("should infer constraint from explicit objects", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new Handler();
            provides.addHandler(inventory, cashier);
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve copy of object with @copy", () => {
            const Circle = class {
                      constructor(radius) {
                          this.radius = radius;
                      }

                      copy() {
                          return new Circle(this.radius);
                      }
                  },
                  circle = new Circle(2),
                  shapes = new (class extends Handler {
                      @copy
                      @provides(Circle)                      
                      circle() { return circle; }
                  }),
                  shapesG = new (class extends Handler {
                      @copy
                      @provides(Circle)                      
                      get circle() { return circle; }
                  });                  
           const shape  = shapes.resolve(Circle),
                 shapeG = shapesG.resolve(Circle);
           expect(shape).to.not.equal(circle);
           expect(shape.radius).to.equal(2);
           expect(shapeG).to.not.equal(circle);
           expect(shapeG.radius).to.equal(2);            
        });

        it("should resolve objects by class implicitly", () => {
            const cashier = new Cashier(1000000.00),
                  casino  = new Casino("Belagio").addHandlers(cashier);
            expect(casino.resolve(Casino)).to.equal(casino);
            expect(casino.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve objects by protocol implicitly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  casino    = new Casino("Belagio").addHandlers(blackjack);
            expect(casino.resolve(Game)).to.equal(blackjack);
        });

        it("should resolve objects by class explicitly", () => {
            const casino  = new Casino("Belagio"),
                  pitBoss = casino.resolve(PitBoss);
            expect(pitBoss).to.be.an.instanceOf(PitBoss);
        });

        it("should resolve objects by per instance", () => {
            const cashier  = new Cashier(1000000.00),
                  provider = new Handler();
            provides.addHandler(provider, Cashier, () => cashier);
            expect(provider.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve objects by class invariantly", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (class extends Handler {
                      @provides($eq(Cashier))
                      cashier() { return cashier; }
                  });
            expect(inventory.resolve(Accountable)).to.be.undefined;
            expect(inventory.resolve(Cashier)).to.equal(cashier);
            provides.addHandler(inventory, Cashier, inquiry => cashier);
            expect(inventory.resolve(Accountable)).to.equal(cashier);
        });

        it("should resolve objects by protocol invariantly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides($eq(Game))
                      game() { return blackjack; }
                  });
            expect(cardGames.resolve(CardTable)).to.be.undefined;
            expect(cardGames.resolve(Game)).to.equal(blackjack);
        });

        it("should resolve objects by class instantly", () => {
            const cashier   = new Cashier(1000000.00),
                  blackjack = new CardTable("BlackJack", 1, 5),
                  inventory = new (class extends Handler {
                      @provides(Cashier)
                      cashier() { return cashier; }

                      @provides(CardTable)
                      blackjack() { return Promise.resolve(blackjack); }                      
                  });
            expect(inventory.resolve($instant(Cashier))).to.equal(cashier);
            expect($isPromise(inventory.resolve(CardTable))).to.be.true;
            expect(inventory.resolve($instant(CardTable))).to.be.undefined;
        });

        it("should resolve objects by protocol instantly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides(Game)
                      game() { return Promise.resolve(blackjack); }
                  });
            expect($isPromise(cardGames.resolve(Game))).to.be.true;
            expect(cardGames.resolve($instant(Game))).to.be.undefined;
        });

        it("should resolve base2 constructor", () => {
            const Car     = Protocol.extend(),
                  Ferarri = @conformsTo(Car) @provides() class {},          
                  handler = new InferenceHandler(Ferarri),
                  car     = handler.resolve(Car);  
            expect(car).to.be.instanceOf(Ferarri);               
        });

        it("should resolve base2 constructor with dependencies", () => {
            const Car     = Protocol.extend(),
                  Engine  = Protocol.extend(),
                  V12     = @conformsTo(Engine) @provides() class {},
                  Ferarri = @conformsTo(Car) @design(Engine) @provides() class {
                      constructor(engine) {
                          this.engine = engine;
                      }
                  },          
                  handler = new InferenceHandler(Ferarri, V12),
                  car     = handler.resolve(Car);  
            expect(car).to.be.instanceOf(Ferarri);
            expect(car.engine).to.be.instanceOf(V12);             
        });

        it("should reject provides with arguments on class", () => {
            expect(() => {
                const Car     = Protocol.extend(),
                      Ferarri = @conformsTo(Car) @provides(Car) class {}; 
            }).to.throw(SyntaxError, "@provides expects no arguments if applied to a class.");     
        });

        it("should reject provides with arguments on base2 class", () => {
            expect(() => {
                const Car     = Protocol.extend(),
                      Ferarri = Base.extend(provides(Car), Car);
            }).to.throw(SyntaxError, "@provides expects no arguments if applied to a class."); 
        });

        it("should reject provides with arguments on base2 constructor", () => {
            expect(() => {
                const Car     = Protocol.extend(),
                      Ferarri = Base.extend(Car, {
                          @provides(Car)
                          constructor() {}
                      });
            }).to.throw(SyntaxError, "@provides expects no arguments if applied to a constructor.");     
        });

        it("should resolve class constructor", () => {
            const Car = Protocol.extend();
            @conformsTo(Car)
            @provides() class Ferarri {  
                constructor() {}
            };
            const handler = new InferenceHandler(Ferarri),  
                  car     = handler.resolve(Car);  
            expect(car).to.be.instanceOf(Ferarri);      
        });

        it("should resolve by string literal", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.resolve("BlackJack")).to.equal(blackjack);
        });

        it("should resolve by string literal case-insensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.resolve("BLACKJACK")).to.equal(blackjack);
        });

        it("should resolve by string literal case-sensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.resolve($eq("BLACKJACK"))).to.be.undefined;
        });
        
        it("should resolve by string instance", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.resolve(new String("BlackJack"))).to.equal(blackjack);
        });

        it("should resolve by string instance case-insensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.resolve(new String("blackjack"))).to.equal(blackjack);
        });

        it("should resolve by string instance case-sensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.resolve($eq(new String("blackjack")))).to.be.undefined;
        });
        
        it("should resolve string by regular expression", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides(/black/i)
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.resolve("BlackJack")).to.equal(blackjack);
        });

        it("should resolve instances using instance class", () => {
            const Config = class extends Base {
                      constructor(key) {
                          super();
                          this.extend({
                              get key() { return key; }
                          });
                      }
                  }, 
                  settings = new (class extends Handler {
                      @provides(Config)
                      config(inquiry) {
                          const config = inquiry.key,
                                key    = config.key;
                          if (key == "url") {
                              return "my.server.com";
                          } else if (key == "user") {
                              return "dba";
                          }
                      }
                  });
                expect(settings.resolve(new Config("user"))).to.equal("dba");
                expect(settings.resolve(new Config("name"))).to.be.undefined;
        });

        it("should resolve objects with compound keys", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cashier   = new Cashier(1000000.00),
                  cardGames = new (class extends Handler {
                      @provides(CardTable, Cashier)
                      stuff(inquiry) {
                          const key = inquiry.key;
                          if (Game.isAdoptedBy(key)) {
                              return blackjack;
                          } else if (key === Cashier) {
                              return cashier;
                          }
                      }
                  });
            expect(cardGames.resolve(Game)).to.equal(blackjack);
            expect(cardGames.resolve(Cashier)).to.equal(cashier);
        });

        it("should unregister objects with compound keys", () => {
            const blackjack  = new CardTable("BlackJack", 1, 5),
                  cashier    = new Cashier(1000000.00),
                  cardGames  = new Handler(),
                  unregister = provides.addHandler(cardGames, [CardTable, Cashier],
                      inquiry => {
                          const key = inquiry.key;
                          if (Game.isAdoptedBy(key)) {
                              return blackjack;
                          } else if (key === Cashier) {
                             return cashier;
                      }});
            expect(cardGames.resolve(Game)).to.equal(blackjack);
            expect(cardGames.resolve(Cashier)).to.equal(cashier);
            unregister();
            expect(cardGames.resolve(Game)).to.be.undefined;
            expect(cardGames.resolve(Cashier)).to.be.undefined;
        });

        it("should not resolve objects if not found", () => {
            const something = new Handler();
            expect(something.resolve(Cashier)).to.be.undefined;
        });

        it("should not resolve objects if $unhandled", () => {
            const inventory = new (class extends Handler {
                @provides(Cashier)
                notHandled() { return $unhandled; }
            });
            expect(inventory.resolve(Cashier)).to.be.undefined;
        });

        it("should resolve unknown objects", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @provides($eval(True))
                      unknown(inquiry) {
                          if (inquiry.key === CardTable) {
                              return blackjack;
                          }
                      }
                  });
            expect(cardGames.resolve(CardTable)).to.equal(blackjack);
            expect(cardGames.resolve(Game)).to.be.undefined;
        });

        it("should resolve objects by class eventually", done => {
            const casino = new Casino("Venetian");
            Promise.resolve(casino.resolve(DrinkServer)).then(server => {
                expect(server).to.be.an.instanceOf(DrinkServer);
                done();
            });
        });

        it("should not resolve by string", () => {
            const casino = new Casino("Venetian");
            expect(casino.resolve("slot machine")).to.be.undefined;
        });

        it("should resolve with precedence rules", () => {
            const Checkers  = @conformsTo(Game) class {},
                  inventory = new (class extends Handler {
                      @provides($eval(c => c === PitBoss))
                      predicate() { return 0; }

                      @provides
                      anything() { return 1; }

                      @provides(Checkers)
                      anonymousType() { return 2; }

                      @provides(Level1Security)
                      type() { return 3; }

                      @provides(Activity)
                      derivedType() { return 5; }

                      @provides(Accountable)
                      baseType() { return 4; }

                      @provides(CardTable)
                      deepType() { return 6; }
                  });
            expect(inventory.resolve(CardTable)).to.equal(6);
            expect(inventory.resolve(Activity)).to.equal(5);
            expect(inventory.resolve(Cashier)).to.equal(1);
            expect(inventory.resolve(Security)).to.equal(3);
            expect(inventory.resolve(Game)).to.equal(2);
            expect(inventory.resolve(Casino)).to.equal(1);
            expect(inventory.resolve(PitBoss)).to.equal(0);
        });

        it("should infer resolve", () => {
            const cashier   = new Cashier(1000000.00),
                  Inventory = @provides() class extends Handler {
                      @provides(Cashier)
                      cashier() { return cashier; }
                  },
                  handler = new InferenceHandler(Inventory);
            expect(handler.resolve(Cashier)).to.equal(cashier);
        });

        it("should infer promise resolve", done => {
            const cashier   = new Cashier(1000000.00),
                  Inventory = @provides() class extends Handler {
                      @provides(Cashier)
                      cashier() { return Promise.resolve(cashier); }
                  },
                  handler = new InferenceHandler(Inventory);
            Promise.resolve(handler.resolve(Cashier)).then(result => {
                expect(result).to.equal(cashier);
                done();
            });
        });

        it("should fail infer resolve", () => {
            const Inventory = @provides() class extends Handler {
                      @provides(Cashier)
                      cashier() {}
                  },
                  handler = new InferenceHandler(Inventory);
            expect(handler.resolve(Cashier)).to.be.undefined;   
        });

        it("should fail infer promise resolve", done => {
            const Inventory = @provides() class extends Handler {
                      @provides(Cashier)
                      cashier() { 
                          return Promise.reject("Cashier is sick");
                      }
                  },
                  handler = new InferenceHandler(Inventory);
            Promise.resolve(handler.resolve(Cashier)).then(result => {
                expect(result).to.be.undefined;  
                done();
            });
        });    
    });

    describe("#resolveAll", () => {
        it("should resolve all objects by class explicitly", done => {
            const belagio  = new Casino("Belagio"),
                  venetian = new Casino("Venetian"),
                  paris    = new Casino("Paris"),
                  strip    = belagio.$chain(venetian, paris);
            Promise.resolve(strip.resolveAll(Casino)).then(casinos => {
                expect(casinos).to.eql([belagio, venetian, paris]);
                done();
            });
        });

        it("should resolve all objects by class eventually", done => {
            const stop1 = [ new PitBoss("Craig"),  new PitBoss("Matthew") ],
                  stop2 = [ new PitBoss("Brenda"), new PitBoss("Lauren"), new PitBoss("Kaitlyn") ],
                  stop3 = [ new PitBoss("Phil") ],
                  bus1  = new (class extends Handler {
                      @provides(PitBoss)
                      pitBoss(inquiry) {
                          expect(inquiry.isMany).to.be.true;
                          return Promise.delay(75).then(() => stop1);
                      }
                  }),
                  bus2  = new (class extends Handler {
                      @provides(PitBoss)
                      pitBoss(inquiry) {               
                          expect(inquiry.isMany).to.be.true;
                          return Promise.delay(100).then(() => stop2);
                      }
                  }),
                  bus3  = new (class extends Handler {
                      @provides(PitBoss)
                      pitBoss(inquiry) {               
                          expect(inquiry.isMany).to.be.true;
                          return Promise.delay(50).then(() => stop3);
                      }
                  }),
                  company = bus1.$chain(bus2, bus3);
            Promise.resolve(company.resolveAll(PitBoss)).then(pitBosses => {
                expect(pitBosses).to.have.members($flatten([stop1, stop2, stop3]));
                done();
            });
        });

        it("should resolve all objects by class instantly", () => {
            const belagio  = new Casino("Belagio"),
                  venetian = new Casino("Venetian"),
                  paris    = new Casino("Paris"),
                  strip    = new (class extends Handler {
                      @provides(Casino)
                      venetion() { return venetian; }

                      @provides(Casino)
                      belagio() { return Promise.resolve(belagio); }

                      @provides(Casino)
                      paris() { return paris; }
                  });
            const casinos = strip.resolveAll($instant(Casino));
            expect(casinos).to.have.members([venetian, paris]);
        });

        it("should return empty array if none resolved", done => {
            Promise.resolve((new Handler).resolveAll(Casino)).then(casinos => {
                expect(casinos).to.have.length(0);
                done();
            });
        });

        it("should return empty array instantly if none resolved", () => {
            const belagio = new Casino("Belagio"),
                  strip   = new (class extends Handler {
                      @provides(Casino)
                      casino() { return Promise.resolve(belagio); }
                  });
            const casinos = strip.resolveAll($instant(Casino));
            expect(casinos).to.have.length(0);
        });
    });

    describe("#lookup", () => {
        it("should lookup by class", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @looksup(CardTable)
                      cardTable() { return blackjack; }

                      @looksup
                      everything() { return blackjack; }
                  });
            expect(cardGames.lookup(CardTable)).to.equal(blackjack);
            expect(cardGames.lookup(Game)).to.be.undefined;
        });

        it("should lookup by protocol", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @looksup(Game)
                      game() { return blackjack; }

                      @looksup
                      everything() { return blackjack; }
                  });
            expect(cardGames.lookup(Game)).to.equal(blackjack);
            expect(cardGames.lookup(CardTable)).to.be.undefined;
        });

        it("should lookup by string", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (class extends Handler {
                      @looksup("blackjack")
                      blackjack() { return blackjack; }

                      @looksup(/game/)
                      blackjack() { return blackjack; }
                  });
            expect(cardGames.lookup("blackjack")).to.equal(blackjack);
            expect(cardGames.lookup("game")).to.be.undefined;
        });
    });

    describe("#filter", () => {
        it("should accept callback", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(casino.filter((cb, cm, proceed) => proceed())
                   .handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(1000000.00);
        });

        it("should reject callback", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(casino.filter(False).handle(countMoney)).to.be.false;
        });

        it("should ignore filter when reentrant", () => {
            const cashier      = new Cashier(1000000.00),
                  casino       = new Casino("Belagio").addHandlers(cashier),
                  countMoney   = new CountMoney;
            let   filterCalled = 0;
            expect(casino.filter((cb, cm, proceed) => {
                ++filterCalled;
                expect(cm.resolve(Cashier)).to.equal(cashier);
                return proceed();
            }).handle(countMoney)).to.be.true;
            expect(filterCalled).to.equal(1);
        });
    });

    describe("#aspect", () => {
        it("should ignore callback", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney();
            expect(() => {
                casino.$aspect(False).handle(countMoney);
            }).to.throw(RejectedError);
        });

        it("should ignore invocation", () => {
            const guest = new Guest(21),
                  level = Handler.for(new Level1Security);
            expect(() => {
                Security(level.$aspect(False)).admit(guest);
            }).to.throw(RejectedError);
        });

        it("should handle callback with side-effect", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney();
            expect(casino.$aspect(True, cb => cb.record(-1))
                   .handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(999999.00);
        });

        it("should invoke with side-effect", () => {
            let count = 0,
                guest = new Guest(21),
                level = Handler.for(new Level1Security);
            expect(Security(level.$aspect(True, () => { ++count; }))
                            .admit(guest)).to.be.true;
            expect(count).to.equal(1);
        });

        it("should ignore command callback", done => {
            const cashier   = new Cashier(750000.00),
                  casino    = new Casino("Venetian").addHandlers(cashier),
                  wireMoney = new WireMoney(250000);
            Promise.resolve(casino.$aspect(() => Promise.resolve(false))
                .command(wireMoney)).then(handled => {
                throw new Error("Should not get here");
            }, error => {
                expect(error).to.be.instanceOf(RejectedError);
                done();
            });
        });

        it("should ignore async invocation", done => {
            const level2 = Handler.for(new Level2Security);
            Security(level2.$aspect(() => {
                return Promise.resolve(false);
            })).scan().then(scanned => {
                throw new Error("Should not get here");
            }, error => {
                expect(error).to.be.instanceOf(RejectedError);
                done();
            });
        });

        it("should handle commands with side-effect", done => {
            const cashier   = new Cashier(750000.00),
                  casino    = new Casino("Venetian").addHandlers(cashier),
                  wireMoney = new WireMoney(250000);
            Promise.resolve(casino.$aspect(True, wire => done())
                .command(wireMoney)).then(result => {
                    expect(result).to.equal(result);
                    expect(wireMoney.received).to.equal(250000);
                });
        });

        it("should invoke async with side-effect", done => {
            const level2 = Handler.for(new Level2Security);
            Security(level2.$aspect(True, () => done())).scan().then(scanned => {
                expect(scanned).to.be.true;
            });
        });

        it("should fail on exception in before", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(() => {
                expect(casino.$aspect(() => { throw new Error; })
                       .handle(countMoney)).to.be.false;
            }).to.throw(Error);
        });

        it("should fail callback on rejection in before", done => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney();
            casino.$aspect(() => {
                setTimeout(done, 2);
                return Promise.reject(new Error("Something bad"));
            }).command(countMoney).catch(error => {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal("Something bad");
            });
        });

        it("should fail async invoke on rejection in before", done => {
            const level2 = Handler.for(new Level2Security);
            Security(level2.$aspect(() => {
                setTimeout(done, 2);
                return Promise.reject(new Error("Something bad"));
            })).scan().catch(error => {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal("Something bad");
            });
        });
    });

    describe("#create", () => {
        it("should create instances", () => {
            const inventory = new (class extends Handler {
                      @creates(Cashier)
                      cashier() { return new Cashier(); }
                  });
            expect(inventory.create(Cashier)).to.be.instanceOf(Cashier);
        });
    });

    describe("#$compose", () => {
        it("should make handler the ambient $composer", () => {
            const handler = new Handler();
            handler.$compose(function () {
                expect($composer).to.equal(handler);
            });
        });

        it("should make handler the ambient $composer with receiver", () => {
            const handler = new Handler();
            handler.$compose(function () {
                expect($composer).to.equal(handler);
                expect(this).to.equal(handler);
            }, handler);
        });        
    });

    describe("#next", () => {
        it("should cascade handlers using short syntax", () => {
            const guest    = new Guest(17),
                  baccarat = new Activity("Baccarat"),
                  level1   = new Level1Security(),
                  level2   = new Level2Security(),
                  security = Handler.for(level1).$chain(level2);
            expect(Security(security).admit(guest)).to.be.false;
            Security(security).trackActivity(baccarat);
        });

        it("should compose handlers using short syntax", () => {
            const baccarat = new Activity("Baccarat"),
                  level1   = new Level1Security(),
                  level2   = new Level2Security(),
                  compose  = Handler.for(level1).$chain(level2, baccarat),
            countMoney = new CountMoney();
            expect(compose.handle(countMoney)).to.be.true;
        });
    });

    describe("$provide", () => {
        it("should provide transient values", () => {
            const guest     = new Guest(17),
                  blackjack = new CardTable("BlackJack", 1, 5),
                  handler   = new Handler(),
                  provider  = handler.$provide(guest, blackjack);
            expect(provider.resolve(Guest)).equal(guest);
            expect(provider.resolve(CardTable)).equal(blackjack);
            expect(handler.resolve(Guest)).to.be.undefined;            
            expect(handler.resolve(CardTable)).to.be.undefined;
        })
    });
   
    describe("Options", () => {
        @handlesOptions("serverOptions")
        class ServerOptions extends Options {
            url;
            timeout;
        }

        it("should register options", () => {
            const handler = new Handler(),
                  options = handler.$getOptions(ServerOptions);
            expect(options).to.be.null;
        });

        it("should retrieve options", () => {
            const handler = new Handler().$serverOptions({
                               url:     "http://localhost:3001/api",
                               timeout: 3000
                            }),
                  options = handler.$getOptions(ServerOptions);
            expect(options).to.be.an.instanceof(ServerOptions);
            expect(options.url).to.equal("http://localhost:3001/api");
            expect(options.timeout).to.equal(3000);
        });

        it("should resolve options dependency", () => {
            @provides() class BankApi {
                @handles(WireMoney)
                wire(wireMoney, @options(ServerOptions) options) {
                    return options;
                }
            }
            const handler = new InferenceHandler(BankApi)
                    .$serverOptions({ url: "http://localhost:3001/api" });
                  confirm = handler.command(new WireMoney(15000));
            expect(confirm).to.be.instanceOf(ServerOptions);
            expect(confirm.url).to.equal("http://localhost:3001/api");
        });

        it("should reject register if not an Options type", () => {
            expect(() => {
                Handler.registerOptions(11, "foo");
            }).to.throw(TypeError, "Options type '11' does not extend Options.");
        });

        it("should reject get if not an Options type", () => {
            expect(() => {
                (new Handler).$getOptions("abc");
            }).to.throw(TypeError, "Options type 'abc' does not extend Options.");
        });

        it("should reject if already registered", () => {
            expect(() => {
                Handler.registerOptions(ServerOptions, "serverOptions");
            }).to.throw(Error, "Options key 'serverOptions' is already defined.");                 
        });        
    });
});

describe("CascadeHandler", () => {
    describe("#handle", () => {
        it("should cascade handlers", () => {
            const guest    = new Guest(17),
                  baccarat = new Activity("Baccarat"),
                  level1   = new Level1Security(),
                  level2   = new Level2Security(),
                  security = new CascadeHandler(level1, level2);
            expect(Security(security).admit(guest)).to.be.false;
            Security(security).trackActivity(baccarat);
        });
    });
});

describe("InvocationHandler", () => {
    describe("#handle", () => {
        it("should handle invocations", () => {
            const guest1 = new Guest(17),
                  guest2 = new Guest(21),
                  level1 = Handler.for(new Level1Security());
            expect(Security(level1).admit(guest1)).to.be.false;
            expect(Security(level1).admit(guest2)).to.be.true;
        });
        
        it("should handle async invocations", done => {
            const level2 = Handler.for(new Level2Security());
            Security(level2).scan().then(() => {
                done();
            });
        });

        it("should ignore explicitly unhandled invocations", () => {
            const texasHoldEm = new CardTable("Texas Hold'em", 2, 7),
                  casino      = new Casino("Caesars Palace")
                .addHandlers(texasHoldEm);
            expect(() => Game(casino).open(5)).to.not.throw(Error);
            expect(() => Game(casino).open(9)).to.throw(Error, /open could not be handled/);
        });

        it("should fail missing methods", () => {
            const letItRide = new Activity("Let It Ride"),
                  level1    = new Level1Security(),
                  casino    = new Casino("Treasure Island")
                  .addHandlers(level1, letItRide);

            expect(() => {
                Security(casino).trackActivity(letItRide)
            }).to.throw(Error, /trackActivity could not be handled/);
        });

        it("should ignore missing methods", () => {
            const letItRide = new Activity("Let It Ride"),
                  level1    = new Level1Security(),
                  casino    = new Casino("Treasure Island")
                  .addHandlers(level1, letItRide);
            expect(Security(casino.$bestEffort()).trackActivity(letItRide)).to.be.undefined;
        });

        it("should require protocol conformance", () => {
            @conformsTo(Security)
            class Gate extends Handler {
                admit(guest) { return true; }
            };
            const gate = new Gate();
            expect(Security(gate).admit(new Guest("Me"))).to.be.true;
        });

        it("should reject if no protocol conformance", () => {
            const gate = new (class extends Handler {
                      admit(guest) { return true; }
                  });
            expect(() => {
                Security(gate).admit(new Guest("Me"))
            }).to.throw(Error, /admit could not be handled/);
        });

        it("should broadcast invocations", () => {
            let tracked = 0;
            @conformsTo(Security)
            @provides() class Tracker {
                trackActivity(activity) {
                    ++tracked;
                }
            }
            const letItRide = new Activity("Let It Ride"),
                  level1    = new Level1Security(),
                  level2    = new Level2Security(),
                  casino    = new Casino("Treasure Island")
                  .addHandlers(level1, level2, letItRide,
                      new InferenceHandler(Tracker));
            Security(casino.$broadcast()).trackActivity(letItRide);
            expect(tracked).to.equal(1);
        });

        it("should notify invocations", () => {
            const letItRide = new Activity("Let It Ride"),
                  level1    = new Level1Security(),
                  casino    = new Casino("Treasure Island")
                  .addHandlers(level1, letItRide);
            Security(casino.$notify()).trackActivity(letItRide);
        });

        it("should resolve target for invocation", () => {
            const Poker = @conformsTo(Game) class {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  },
                  handler = Handler.for(new Poker()),
                  id      = Game(handler).open(5);
            expect(id).to.equal("poker5");
        });

        it("should resolve target for invocation using promise", done => {
            const Poker = @conformsTo(Game) class {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  },
                  handler = new (class extends Handler {
                      @provides(Game)
                      game() { return Promise.delay(10).then(() => new Poker()); }
                  });
            Game(handler).open(5).then(id => {
                expect(id).to.equal("poker5");
                done();
            });
        });

        it("should resolve target for invocation implicitly", () => {
            const Pumping = Protocol.extend({
                      pump() {}
                  }),
                  Pump = @conformsTo(Pumping) class {
                      pump() { return 5; }
                  },
                  handler = new Handler();
            provides.addHandler(handler, new Pump());
            expect(Pumping(handler).pump()).to.equal(5);
        });
        
        it("should fail invocation if unable to resolve", () => {
            const handler = new Handler();
            expect(() => {
                Game(handler).open(4);
            }).to.throw(TypeError, /open could not be handled/);
        });

        it("should fail invocation if method not found", () => {
            const Poker   = @conformsTo(Game) class {},
                  handler = Handler.for(new Poker());
            expect(() => {
                Game(handler).open(4);
            }).to.throw(TypeError, /open could not be handled/);
        });

        it("should fail invocation promise if method not found", done => {
            const Poker   = @conformsTo(Game) class {},
                  handler = new (class extends Handler {
                      @provides(Game)
                      game() { return Promise.delay(10).then(() => new Poker()); }
                  });
            Game(handler).open(5).catch(error => {
                expect(error).to.be.instanceOf(TypeError);
                expect(error.message).to.match(/open could not be handled/)
                done();
            });            
        });

        it("should ignore invocation if unable to resolve", () => {
            const handler = new Handler(),
                  id      = Game(handler.$bestEffort()).open(4);
            expect(id).to.be.undefined;
        });

        it("should ignore invocation if unable to resolve promise", done => {
            const handler = new (class extends Handler {
                @provides(Game)
                game() { return Promise.delay(10).then(() => $unhandled); }
              });
            Game(handler.$bestEffort()).open(5).then(id => {
                expect(id).to.be.undefined;
                done();
            });            
        });
        
        it("should resolve all targets or invocation", () => {
            let   count = 0;
            const Poker = @conformsTo(Game) class {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  },
                  Slots = @conformsTo(Game) class {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  },                
                  handler = new CascadeHandler(new Poker(), new Slots()),
                  id      = Game(handler.$broadcast()).open(5);
            expect(id).to.equal("poker5");
            expect(count).to.equal(2);
        }).timeout(10000);

        it("should resolve all targets or invocation using promise", done => {
            let   count = 0;
            const Poker = @conformsTo(Game) class {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  },
                  Slots = @conformsTo(Game) class {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  },
                  handler = new CascadeHandler(
                      new (class extends Handler {
                          @provides(Game)
                          game() {
                              return Promise.delay(10).then(() => new Poker());
                          }
                      }),
                      new (class extends Handler {
                          @provides(Game)
                          game() {
                              return Promise.delay(5).then(() => new Slots());
                          }
                      })
                  );
            Game(handler.$broadcast()).open(5).then(id => {
                expect(id).to.equal("poker5");
                expect(count).to.equal(2);                
                done();
            });
        });
        
        it("should fail invocation if unable to resolve all", () => {
            const handler = new Handler();
            expect(() => {
                Game(handler.$broadcast()).open(4);
            }).to.throw(Error, /open could not be handled/);
        });

        it("should apply filters to resolved invocations", () => {
            const Poker = @conformsTo(Game) class {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  },
                  handler = Handler.for(new Poker());
            expect(Game(handler.filter(
                (cb, cm, proceed) => proceed())).open(5))
                .to.equal("poker5");
            expect(() => {
                Game(handler.filter(False)).open(5);
            }).to.throw(Error, /open could not be handled/);
        });
    })
});

describe("Handler", () => {
    const Emailing = Protocol.extend({
             send(msg) {},
             sendConfirm(msg) {},        
             fail(msg) {},
             failConfirm(msg) {}        
          }),
          Offline = Emailing.extend();

    @conformsTo(Emailing)
    class EmailHandler extends Handler {
        send(msg) {
            const batch = this.ensureBatch();
            return batch ? batch.send(msg) : msg; 
        }

        sendConfirm(msg) {
            const batch = this.ensureBatch();
            return batch ? batch.sendConfirm(msg)
                : Promise.resolve(msg);
        }

        fail(msg) {
            if (msg === "OFF") {
                return Offline($composer).fail(msg);
            }
            throw new Error("Can't send message");
        }

        failConfirm(msg) {
            const batch = this.ensureBatch();
            return batch ? batch.failConfirm(msg)
                : Promise.reject(Error("Can't send message"));
        }

        ensureBatch() {
            const batch = $composer.$getBatch(Emailing);
            if (batch) {
                const emailBatch = new EmailBatch();
                batch.addHandlers(emailBatch);
                return emailBatch;
            }
        }
    }
          
    @conformsTo(Offline)
    class OfflineHandler extends Handler {
        send(msg) { return 99; }
        sendConfirm(msg) {
            throw new Error("Can't confirm message offline");
        }
        fail(msg) { return -1; }
        failConfirm(msg) {}
    }

    class DemoHandler extends Handler {
        send(msg) { return msg; }
        sendConfirm(msg) { return Promise.resolve(msg); }         
        fail(msg) {}
        failConfirm(msg) {}
    }

    @conformsTo(Emailing, Batching)
    class EmailBatch extends Base {
        constructor() {
            super();
            _(this).msgs     = [];
            _(this).resolves = [];
            _(this).promises = [];
        }

        send(msg) {
            _(this).msgs.push(msg + " batch");
        }

        sendConfirm(msg) {
            const { msgs, resolves, promises } = _(this);
            msgs.push(msg);
            const promise = new Promise(resolve =>
                resolves.push(() => { resolve(msg + " batch"); })
            );
            promises.push(promise);
            return promise;
        }

        failConfirm(msg) {
            const { resolves, promises } = _(this);
            const promise = new Promise((resolve, reject) =>
                resolves.push(() => { reject(Error("Can't send message")); })
            );
            promises.push(promise);
            return promise;
        }

        complete(composer) {
            const { msgs, resolves, promises } = _(this);
            for (let i = 0; i < resolves.length; ++i) {
                resolves[i]();
            }
            const results = Emailing(composer).send(msgs);
            return promises.length > 0
                    ? Promise.all(promises).then(() => results)
                    : results;
        }          
    }

    it("should require protocol conformance", () => {
        const handler = new DemoHandler();
        expect(() => Emailing(handler).send("Hello")).to.throw(Error, /send could not be handled/);
    });

    it("should require protocol invariance", () => {
        const handler = new DemoHandler();
        expect(() => Offline(handler).send("Hello")).to.throw(Error, /send could not be handled/);
    });

    it("should handle methods covariantly", () => {
        const handler = new CompositeHandler().addHandlers(new OfflineHandler());
        expect(Emailing(handler).fail("Hello")).to.equal(-1);         
    });

    it("should handle methods polymorphically", () => {
        const handler = new EmailHandler().$chain(new OfflineHandler());
        expect(Emailing(handler).fail("OFF")).to.equal(-1);         
    });
    
    it("should handle methods strictly", () => {
        const handler = new OfflineHandler();
        expect(() => Emailing(handler.$strict()).send("Hello")).to.throw(Error, /send could not be handled/);
    });

    it("should chain handle methods strictly", () => {
         const handler = new OfflineHandler().$chain(new EmailHandler());
         expect(Emailing(handler.$strict()).send("Hello")).to.equal("Hello");         
    });

    it("should handle handle methods loosely", () => {
        const handler = new DemoHandler();
        expect(Emailing(handler.$duck()).send("Hello")).to.equal("Hello");         
    });
       
    describe("#$promise", () => {
        it("should convert return to promise", done => {
            const handler = new EmailHandler();
            expect(Emailing(handler).send("Hello")).to.eql("Hello");
            Emailing(handler.$promise()).send("Hello").then(result => {
                expect(result).to.eql("Hello");
                done();
            });
        });
        
        it("should convert undefined to promise", done => {
            const handler = new EmailHandler();
            expect(Emailing(handler).send()).to.be.undefined;
            Emailing(handler.$promise()).send().then(result => {
                expect(result).to.be.undefined;
                done();
            });
        });

        it("should adopt promise returns", done => {
            const handler = new EmailHandler,
                  msg     = Promise.resolve("Hello");
            Emailing(handler).send(msg).then(result => {
                expect(result).to.eql("Hello");
                done();
            });
            Emailing(handler.$promise()).send(msg).then(result => {
                expect(result).to.eql("Hello");
                done();
            });
        });

        it("should convert exception to promise", done => {
            const handler = new EmailHandler();
            expect(() => {
                Emailing(handler).fail()                
            }).to.throw(Error, "Can't send message");
            Emailing(handler.$promise()).fail().catch(err => {
                expect(err.message).to.equal("Can't send message");
                done();
            });
        });        
    });
    
    describe("#$timeout", () => {
        it("should reject promise if timed out", done => {
            const bank = new (class extends Handler {
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }
                  }),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50).command(wireMoney)).catch(err => {
                expect(err).to.be.instanceOf(TimeoutError);
                done();
            });
        });

        it("should ignore time out if promise resolved", done => {
            const bank = new (class extends Handler {
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(50).then(() => wireMoney);
                      }
                  }),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(100).command(wireMoney)).then(result => {
                expect(result).to.equal(wireMoney);
                expect(wireMoney.received).to.equal(50000);
                done();
            });
        });
        
        it("should reject promise with error instance", done => {
            const bank = new (class extends Handler {
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }                
                  }),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50, new Error("Oh No!"))
                            .command(wireMoney)).catch(err => {
                expect(err.message).to.equal("Oh No!");
                done();
            });
        });

        it("should reject promise with custom error class", done => {
            function BankError(callback) {
                this.callback = callback;
                Error.call(this);
            }
            BankError.prototype             = new Error();
            BankError.prototype.constructor = BankError;
            const bank = new (class extends Handler {
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }                
                  }),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50, BankError)
                            .command(wireMoney)).catch(err => {
                expect(err).to.be.instanceOf(BankError);
                expect(err.callback.callback).to.equal(wireMoney);
                done();
            });
        });

        it("should propogate errors", done => {
            const bank = new (class extends Handler {
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          return Promise.reject(new Error("No money"))                    
                      }                
                  }),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50, new Error("Oh No!"))
                            .command(wireMoney)).catch(err => {
                expect(err.message).to.equal("No money");
                done();
            });
        });        
    });
 
    describe("#$batch", () => {
        it("should batch callbacks", () => {
            const handler = new EmailHandler(),
                  batch   = handler.$batch();
            expect(Emailing(handler).send("Hello")).to.equal("Hello");
            expect($using(batch, () => {
                expect(Emailing(batch).send("Hello")).to.be.undefined;
            })).to.eql([["Hello batch"]]);
            expect(Emailing(batch).send("Hello")).to.equal("Hello");
        });

        it("should batch async callbacks", done => {
            let   count    = 0;
            const handler = new EmailHandler();
            Emailing(handler).sendConfirm("Hello").then(result => {
                expect(result).to.equal("Hello");
                ++count;
            });
            $using(handler.$batch(), batch => {
                Emailing(batch).sendConfirm("Hello").then(result => {
                    expect(result).to.equal("Hello batch");
                    ++count;
                });
            }).then(result => {
                expect(result).to.eql([["Hello"]]);
                Emailing(handler).sendConfirm("Hello").then(result => {
                    expect(result).to.equal("Hello");
                    expect(count).to.equal(2);
                    done();
                });
            });
        });
        
        it("should reject batch async", done => {
            let   count   = 0;
            const handler = new EmailHandler();
            $using(handler.$batch(), batch => {
                Emailing(batch).failConfirm("Hello").catch(err => {
                    expect(err.message).to.equal("Can't send message");
                    ++count;
                });
            }).catch(err => {
                expect(err.message).to.equal("Can't send message");
                Emailing(handler).failConfirm("Hello").catch(err => {
                    expect(err.message).to.equal("Can't send message");
                    expect(count).to.equal(1);                    
                    done();
                });
            });
        });

        it("should batch requested protocols", () => {
            const handler = new EmailHandler();
            expect($using(handler.$batch(Emailing), batch => {
                expect(Emailing(batch).send("Hello")).to.be.undefined;
            })).to.eql([["Hello batch"]]);                
        });

        it("should batch requested protocols async", done => {
            let   count   = 0;
            const handler = new EmailHandler();
            Emailing(handler).sendConfirm("Hello").then(result => {
                expect(result).to.equal("Hello");
                ++count;
            });
            $using(handler.$batch(Emailing), batch => {
                Emailing(batch).sendConfirm("Hello").then(result => {
                    expect(result).to.equal("Hello batch");
                    ++count;
                });
            }).then(result => {
                expect(result).to.eql([["Hello"]]);
                Emailing(handler).sendConfirm("Hello").then(result => {
                    expect(result).to.equal("Hello");
                    expect(count).to.equal(2);
                    done();
                });
            });
        });

        it("should not batch unrequested protocols", () => {
            const handler = new EmailHandler();
            expect($using(handler.$batch(Game), batch => {
                expect(Emailing(batch.send("Hello"))).to.equal("Hello");
            })).to.eql([]);
        });

        it("should not batch unrequested protocols async", done => { 
            const handler = new EmailHandler();           
            expect($using(handler.$batch(Game), batch => {
                Emailing(batch).sendConfirm("Hello").then(result => {
                    expect(result).to.equal("Hello");
                    done();
                });
            })).to.eql([]);
        });

        it("should not batch async after completed", done => {
            const handler = new EmailHandler();
            $using(handler.$batch(), batch => {
                Emailing(batch).sendConfirm("Hello").then(result => {
                    Emailing(batch).sendConfirm("Hello").then(result => {
                        expect(result).to.equal("Hello");
                        done();
                    });
                });
            });
        });

        it("should suppress batching", done => {
            const handler = new EmailHandler();
            expect($using(handler.$batch(), batch => {
                expect(Emailing(batch.$noBatch()).send("Hello")).to.equal("Hello");
                done();
            })).to.eql([]);
        });

        it("should work with filters", () => {
            let   count   = 0;
            const handler = new EmailHandler(),
                  batch   = handler.$aspect(null, () => {
                      ++count;
                  }).$batch();
            expect($using(batch, () => {
                expect(Emailing(batch).send("Hello")).to.be.undefined;
            })).to.eql([["Hello batch"]]);
            expect(count).to.equal(2);
        });        
    });

    describe("@unmanaged", () => {
        class ManagedService {}
        const ManagedBase2Service = Base.extend();

        @unmanaged
        class UnmanagedService {}
        const UnmanagedBase2Service = Base.extend(unmanaged);

        it("should be managed by default", () => {
            expect(unmanaged.isDefined(ManagedService)).to.be.false;
            expect(unmanaged.isDefined(ManagedBase2Service)).to.be.false;
        });

        it("should be unmanaged explicitly", () => {
            expect(unmanaged.isDefined(UnmanagedService)).to.be.true;
            expect(unmanaged.isDefined(UnmanagedBase2Service)).to.be.true;
        });

        it("should not allow unmanaged on methods", () => {
            expect(() => {
                class Invalid {
                    @unmanaged
                    hello() {}
                }
            }).to.throw(SyntaxError, "@unmanaged can only be applied to classes.");        
        });

        it("should not allow unmanaged on properties", () => {
            expect(() => {
                class Invalid {
                    @unmanaged
                    get age() {}
                }
            }).to.throw(SyntaxError, "@unmanaged can only be applied to classes.");        
        });

        it("should not allow unmanaged on fields", () => {
            expect(() => {
                class Invalid {
                    @unmanaged
                    total = 0.0;
                }
            }).to.throw(SyntaxError, "@unmanaged can only be applied to classes.");        
        });
    });
});

