import {
    True, False, Undefined, Base, Protocol,
    DuckTyping, Variance, MethodType,
    ResolvingProtocol, assignID, design,
    designWithReturn, copy, $isPromise,
    $eq, $instant, $using, $flatten,
    createKeyChain
} from "miruken-core";

import {
     Handler, HandlerAdapter, $composer
 } from "../src/handler";

import CascadeHandler from "../src/cascade-handler";
import CompositeHandler from "../src/composite-handler";
import HandlerDescriptor from "../src/handler-descriptor";
import Options from "../src/options";

import {
    $policy, $handle, $provide, $lookup,
    handles, provides, looksup
} from "../src/policy"

import HandleMethod from "../src/handle-method";
import { Batching } from "../src/batch";
import { $unhandled } from "../src/callback-policy";

import {
    RejectedError, TimeoutError
} from "../src/errors";

import "../src/handler-helper";
import "../src/handler-options"
import "../src/handler-protocol"

import { expect } from "chai";

const _ = createKeyChain();

const Guest = Base.extend({
    constructor(age) {
        this.age = age;
    }
});

const Dealer = Base.extend({
    shuffle (cards) {
        return cards.sort(() => 0.5 - Math.random());
    }
});

const PitBoss = Base.extend({
    constructor(name) {
        this.name = name;
    }
});

const DrinkServer = Base.extend({
});

const Game = Protocol.extend({
    open(numPlayers) {}
});

const Security = Protocol.extend({
    admit(guest) {},
    trackActivity(activity) {},
    scan() {}
});

const Level1Security = Base.extend(Security, {
    admit(guest) {
        return guest.age >= 21;
    }
});

const Level2Security = Base.extend(Security, {
    trackActivity(activity) {
        console.log(`Tracking '${activity.name}'`);
    },
    scan() {
        return Promise.delay(2).then(True);
    }
});

const WireMoney = Base.extend({
    constructor(requested) {
        this.requested = requested;
    }
});

const CountMoney = Base.extend({
    constructor() {
        _(this).total = 0.0;
    },

    get total() { return _(this).total; },
    record(amount) { _(this).total += amount; }
});

const Accountable = Base.extend({
    constructor(assets, liabilities) {
        _(this).assets      = Number(assets || 0);
        _(this).liabilities = Number(liabilities || 0);
    },

    get assets()      { return _(this).assets; },
    get liabilities() { return _(this).liabilities; },
    get balance()     { return this.assets - this.liabilities; },
    
    addAssets(amount) {
        _(this).assets = _(this).assets + amount;
    },
    addLiabilities(amount) {
        _(this).liabilities = _(this).liabilities + amount;
    },
    transfer(amount, receiver) {
        const { assets, liabilties } = _(this);
        assets -= amount;
        if (assets < 0) {
            _(this).liabilties = (liabilties -= assets);
            _(this).assets     = 0;
        } else {
            _(this).assets = assets;
        }
        receiver.addAssets(amount);
        return Promise.delay(100);
    },

    @handles(CountMoney)
    countMoney(countMoney, composer) {
        countMoney.record(this.balance);        
    }
});

const Cashier = Accountable.extend({
    @handles(WireMoney)
    wireMoney(wireMoney) {
        wireMoney.received = wireMoney.requested;
        return Promise.resolve(wireMoney);        
    },
    toString() { return "Cashier $" + this.balance; }
});

const Activity = Accountable.extend({
    constructor(name) {
        this.base();
        this.name = name;
    },
    toString() { return "Activity " + this.name; }
});

const CardTable = Activity.extend(Game, {
    constructor(name, minPlayers, maxPlayers) {
        this.base(name);
        _(this).minPlayers = minPlayers;
        _(this).maxPlayers = maxPlayers;
    },

    open(numPlayers) {
        const { minPlayers, maxPlayers } = _(this);
        if (minPlayers > numPlayers || numPlayers > maxPlayers)
            return $unhandled;
    }    
});

const Casino = CompositeHandler.extend({
    constructor(name) {
        this.base();
        this.name = name;
    },
    @provides(PitBoss)
    pitBoss() { return new PitBoss("Freddy"); },
    @provides(DrinkServer)
    drinkServer() {
        return Promise.delay(100).then(() => new DrinkServer());
    },
    toString() { return "Casino " + this.name; },
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
    describe("$policy", () => {
        it("Should accept variance option", () => {
            const baz = $policy(Variance.Contravariant, "baz");
            expect(baz).to.be.ok;
        });

        it("Should reject invalid variance option", () => {
            expect(() => {
                $policy({ variance: 1000 }, "policy #2");
            }).to.throw(TypeError, "Invalid variance parameter.");
        });
  
        it("should define callbacks on class", () => {
            const Cashier = Base.extend(null, {
                    @handles(CountMoney)
                    countMoney(countMoney, composer) {
                        countMoney.record(10);
                    }
                });
            const descriptor = HandlerDescriptor.get(Cashier),
                  bindings   = descriptor.getBindings($handle);
            expect(bindings.head.constraint).to.equal(CountMoney);
        });
    });

    describe("#list", () => {
        it("should create $handle when first handler registered", () => {
            const handler  = new Handler();
            $handle.addHandler(handler, True, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle);
            expect(bindings).to.be.ok;
        });

        it("should maintain linked-list of handlers", () => {
            const handler = new Handler();
            $handle.addHandler(handler, Activity, Undefined);
            $handle.addHandler(handler, Accountable, Undefined);
            $handle.addHandler(handler, Game, Undefined);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle);            
            expect(bindings.head.constraint).to.equal(Activity);
            expect(bindings.head.next.constraint).to.equal(Accountable);
            expect(bindings.tail.prev.constraint).to.equal(Accountable);
            expect(bindings.tail.constraint).to.equal(Game);
        });

        it("should order $handle contravariantly", () => {
            const handler = new Handler();
            $handle.addHandler(handler, Accountable, Undefined);
            $handle.addHandler(handler, Activity, Undefined);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle);            
            expect(bindings.head.constraint).to.equal(Activity);
            expect(bindings.tail.constraint).to.equal(Accountable);
        });

        it("should order $handle invariantly", () => {
            const handler = new Handler();
            $handle.addHandler(handler, Activity, Undefined);
            $handle.addHandler(handler, Activity, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle);      
            expect(bindings.head.handler).to.equal(Undefined);
            expect(bindings.tail.handler).to.equal(True);
        });

        it("should order $provide covariantly", () => {
            const handler = new Handler();
            $provide.addHandler(handler, Activity, Undefined);
            $provide.addHandler(handler, Accountable, Undefined);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($provide);          
            expect(bindings.head.constraint).to.equal(Accountable);
            expect(bindings.tail.constraint).to.equal(Activity);
        });

        it("should order $provide invariantly", () => {
            const handler = new Handler();
            $provide.addHandler(handler, Activity, Undefined);
            $provide.addHandler(handler, Activity, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($provide);  
            expect(bindings.head.handler).to.equal(Undefined);
            expect(bindings.tail.handler).to.equal(True);
        });

        it("should order $lookup invariantly", () => {
            const handler = new Handler();
            $lookup.addHandler(handler, Activity, Undefined);
            $lookup.addHandler(handler, Activity, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($lookup);  
            expect(bindings.head.handler).to.equal(Undefined);
            expect(bindings.tail.handler).to.equal(True);
        });

        it("should index first registered handler with head and tail", () => {
            const handler    = new Handler,
                  unregister = $handle.addHandler(handler, True, Undefined);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle);        
            expect(unregister).to.be.a("function");
            expect(bindings.head.handler).to.equal(Undefined);
            expect(bindings.tail.handler).to.equal(Undefined);
        });

        it("should call function when handler removed", () => {
            let handler        = new Handler,
                handlerRemoved = false,
                unregister     = $handle.addHandler(
                    handler, True, Undefined, () => {
                    handlerRemoved = true;
                });
            unregister();
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle); 
            expect(handlerRemoved).to.be.true;
            expect(bindings).to.be.undefined;
        });

        it("should suppress handler removed if requested", () => {
            let handler        = new Handler,
                handlerRemoved = false,
                unregister     = $handle
                    .addHandler(handler, True, Undefined, () => {
                    handlerRemoved = true;
                });
            unregister(false);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle);             
            expect(handlerRemoved).to.be.false;
            expect(bindings).to.be.undefined;
        });

        it("should remove $handle when no handlers remain", () => {
            const handler    = new Handler,
                  unregister = $handle.addHandler(handler, True, Undefined);
            unregister();
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle); 
            expect(bindings).to.be.undefined;
        });
    });

    describe("#index", () => {
        it("should index class constraints using assignID", () => {
            const handler = new Handler,
                  index   = assignID(Activity);
            $handle.addHandler(handler, Activity, Undefined);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle); 
            expect(bindings.getFirst(index).constraint).to.equal(Activity);
        });

        it("should index protocol constraints using assignID", () => {
            const handler   = new Handler,
                  index     = assignID(Game);
            $handle.addHandler(handler, Game, Undefined);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle); 
            expect(bindings.getFirst(index).constraint).to.equal(Game);
        });

        it("should index string constraints using string", () => {
            const handler   = new Handler();
            $handle.addHandler(handler, "something", Undefined);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle); 
            expect(bindings.getFirst("something").handler).to.equal(Undefined);
        });

        it("should move index to next match", () => {
            let handler     = new Handler,
                index       = assignID(Activity),
                unregister  = $handle.addHandler(handler, Activity, Undefined);
            $handle.addHandler(handler, Activity, True);
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle); 
            expect(bindings.getFirst(index).handler).to.equal(Undefined);
            unregister();
            expect(bindings.getFirst(index).handler).to.equal(True);
        });

        it("should remove index when no more matches", () => {
            const handler   = new Handler,
                  index     = assignID(Activity);
            $handle.addHandler(handler, Accountable, Undefined);
            const unregister = $handle.addHandler(handler, Activity, Undefined);
            unregister();
            const descriptor = HandlerDescriptor.get(handler),
                  bindings   = descriptor.getBindings($handle); 
            expect(bindings.getFirst(index)).to.be.undefined;
        });
    });

    describe("#removeAll", () => {
        it("should remove all $handler definitions", () => {
            let handler     = new Handler,
                removeCount = 0,
                removed     = () => { ++removeCount; };
            $handle.addHandler(handler, Accountable, Undefined, removed);
            $handle.addHandler(handler, Activity, Undefined, removed);
            const descriptor = HandlerDescriptor.get(handler);
            descriptor.removeBindings($handle);
            expect(removeCount).to.equal(2);
            expect(descriptor.getBindings($handle)).to.be.undefined;
        });

        it("should remove all $provider definitions", () => {
            let handler     = new Handler,
                removeCount = 0,
                removed     = () => { ++removeCount; };
            $provide.addHandler(handler, Activity, Undefined, removed);
            $provide.addHandler(handler, Accountable, Undefined, removed);
            const descriptor = HandlerDescriptor.get(handler);
            descriptor.removeBindings($provide);
            expect(removeCount).to.equal(2);
            expect(descriptor.getBindings($provide)).to.be.undefined;
        });
    });
});

describe("Options", () => {
    const MyOptions = Options.extend({
        ack:   false,
        log:   false,
        child: undefined
    });

    describe("#copy", () => {
        it("should copy options", () => {
            const options     = new Options({ack: true, log: true}),
                  optionsCopy = options.copy();
            expect(optionsCopy).to.not.equal(options);
            expect(optionsCopy.ack).to.be.true;
            expect(optionsCopy.log).to.be.true;
            expect(optionsCopy.child).to.be.undefined;
        });

        it("should copy nested Options", () => {
            const options = new Options({
                      ack:   true,
                      log:   true,
                      child: new MyOptions({ack: true})
                  }),
                  optionsCopy = options.copy();
            expect(optionsCopy).to.not.equal(options);
            expect(optionsCopy.ack).to.be.true;
            expect(optionsCopy.log).to.be.true;
            expect(optionsCopy.child).to.not.equal(options.child);
            expect(optionsCopy.child.ack).to.be.true;
            expect(optionsCopy.child.log).to.be.false;
            expect(optionsCopy.child.child).to.be.undefined;            
        });        
    });

    describe("#mergeInto", () => {
        it("should merge options", () => {
            const options1 = new Options({
                      ack:   true,
                      log:   true,
                      child: new MyOptions({ack: true})                
                  }),
                  options2 = new Options({log: false});
            options1.mergeInto(options2);
            expect(options2.ack).to.be.true;
            expect(options2.log).to.be.false;
            expect(options2.child).to.not.equal(options1.child);
            expect(options2.child.ack).to.be.true;
            expect(options2.child.log).to.be.false;            
        });

        it("should merge nested options", () => {
            const options1 = new Options({
                      ack:   true,
                      log:   true,
                      child: new MyOptions({ack: true})
                  }),
                  options2 = new Options({
                      log:   false,
                      child: new MyOptions({
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
            const cashier    = Handler(new Cashier(1000000.00)),
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
            $handle.addHandler(handler, Cashier, function (cashier) {
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
                  handler    = new (Handler.extend().implement({
                      @handles(Cashier)
                      account(cashier) {
                          this.cashier = cashier;                          
                      }                      
                  }));
            expect(handler.handle(cashier)).to.be.true;
            expect(handler.cashier).to.equal(cashier);
        });

        it("should handle callback hierarchy", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (Handler.extend({
                      @handles(Accountable)
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  }));
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
        });

        it("should ignore callback if $unhandled", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (Handler.extend({
                      @handles(Cashier)
                      ignore(cashier) { return $unhandled; }
                  }));
            expect(inventory.handle(cashier)).to.be.false;
        });

        it("should handle callback invariantly", () => {
            const cashier     = new Cashier(1000000.00),
                  accountable = new Accountable(1.00),
                  inventory   = new (Handler.extend({
                      @handles($eq(Accountable))
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  }));
            expect(inventory.handle(cashier)).to.be.false;
            expect(inventory.handle(accountable)).to.be.true;
            expect(inventory.accountable).to.equal(accountable);
            $handle.addHandler(inventory, Accountable, function (accountable) {
                this.accountable = accountable;
            });
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
        });
        
        it("should stop early if handle callback invariantly", () => {
            const cashier     = new Cashier(1000000.00),
                  accountable = new Accountable(1.00),
                  inventory   = new (Handler.extend({
                      @handles(Accountable)
                      ignore(accountable) {},
                      @handles
                      everything(callback) {}
                  }));
            expect(inventory.handle($eq(accountable))).to.be.true;
            expect(inventory.handle($eq(cashier))).to.be.false;
        });
        
        it("should handle callback protocol conformance", () => {
            const blackjack  = new CardTable("Blackjack"),
                  inventory  = new (Handler.extend({
                      @handles(Game)
                      play(game) {
                          this.game = game;
                      }
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.game).to.equal(blackjack);
        });

        it("should prefer callback hierarchy over protocol conformance", () => {
            const blackjack  = new CardTable("Blackjack"),
                  inventory  = new (Handler.extend({
                      @handles(Activity)
                      activity(activity) {
                          this.activity = activity;
                      },
                      @handles(Game)
                      play(game) {
                          this.game = game;
                      }                      
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.activity).to.equal(blackjack);
            expect(inventory.game).to.be.undefined;
        });

        it("should prefer callback hierarchy and continue with protocol conformance", () => {
            const blackjack  = new CardTable("Blackjack"),
                  inventory  = new (Handler.extend({
                      @handles(Activity)
                      activity(activity) {
                          this.activity = activity;
                          return $unhandled;
                      },
                      @handles(Game)
                      play(game) {
                          this.game = game;
                      }                      
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.activity).to.equal(blackjack);
            expect(inventory.game).to.equal(blackjack);
        });

        it("should handle unknown callback", () => {
            const blackjack = new CardTable("Blackjack"),
                  inventory = new (Handler.extend({
                      @handles
                      everything(callback) {
                          callback.check = true;
                      }
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(blackjack.check).to.be.true;
        });

        it("should handle unknown callback via delegate", () => {
            const blackjack = new CardTable("Blackjack"),
                  inventory = new (Base.extend({
                      @handles
                      everything(callback) {
                          callback.check = true;
                      }
                  })),
                  casino   = new Casino("Belagio").addHandlers(inventory);
            expect(casino.handle(blackjack)).to.be.true;
            expect(blackjack.check).to.be.true;
        });

        it("should allow handlers to chain to base", () => {
            const blackjack = new CardTable("Blackjack"),
                  Tagger    = Handler.extend({
                      @handles(Activity)
                      activity(activity) {
                          activity.tagged++;
                      }
                  }),
                  inventory  = new (Tagger.extend({
                      activity(activity) {
                          activity.tagged++;                          
                          this.base(activity);
                      }
                  }));
            blackjack.tagged = 0;
            expect(inventory.handle(blackjack)).to.be.true;
            expect(blackjack.tagged).to.equal(2);
        });

        it("should handle callbacks with precedence rules", () => {
            let matched   = -1,
                Checkers  = Base.extend(Game),
                inventory = new (Handler.extend({
                    @handles(c => c === PitBoss)
                    pitBoss() { matched = 0; },
                    @handles
                    anything() { matched = 1; },
                    @handles(Game)
                    game() { matched = 2; },
                    @handles(Security)
                    security() { matched = 3; },
                    @handles(Activity)
                    activity() { matched = 5; },
                    @handles(Accountable)
                    accountable() { matched = 4; },
                    @handles(CardTable)
                    cardTable() { matched = 6; }
                }));
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
                  bank      = new (Accountable.extend()),
                  inventory = new (Handler.extend({
                      @handles(Cashier, Activity)
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  }));
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.accountable).to.equal(blackjack);
            expect(inventory.handle(bank)).to.be.false;
        });

        it("should unregister compound keys", () => {
            const cashier    = new Cashier(1000000.00),
                  blackjack  = new Activity("Blackjack"),
                  bank       = new (Accountable.extend()),
                  inventory  = new Handler,
                  unregister = $handle.addHandler(inventory, [Cashier, Activity],
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
            const bank = (new (Handler.extend({
                        @handles(WireMoney)
                        wireMoney(wireMoney) {
                            wireMoney.received = 50000;
                            return Promise.delay(100).then(() => wireMoney);
                        }
                  }))),
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
                  inventory = new (Handler.extend({
                      @provides(Cashier)
                      cashier() { return cashier; }
                  }));
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });

        it("should check design return type if empty @provides", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (Handler.extend({
                      @provides
                      @designWithReturn(Cashier)
                      cashier() { return cashier; }
                  }));
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });
        
        it("should infer constraint from explicit objects", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new Handler();
            $provide.addHandler(inventory, cashier);
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve copy of object with @copy", () => {
            const Circle = Base.extend({
                      constructor(radius) {
                          this.radius = radius;
                      },
                      copy() {
                          return new Circle(this.radius);
                      }
                  }),
                  circle = new Circle(2),
                  shapes = new (Handler.extend({
                      @copy
                      @provides(Circle)                      
                      circle() { return circle; }
                  })),
                  shapesG = new (Handler.extend({
                      @copy
                      @provides(Circle)                      
                      get circle() { return circle; }
                  }));                  
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
            $provide.addHandler(provider, Cashier, () => cashier);
            expect(provider.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve objects by class invariantly", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (Handler.extend({
                      @provides($eq(Cashier))
                      cashier() { return cashier; }
                  }));
            expect(inventory.resolve(Accountable)).to.be.undefined;
            expect(inventory.resolve(Cashier)).to.equal(cashier);
            $provide.addHandler(inventory, Cashier, inquiry => cashier);
            expect(inventory.resolve(Accountable)).to.equal(cashier);
        });

        it("should resolve objects by protocol invariantly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides($eq(Game))
                      game() { return blackjack; }
                  }));
            expect(cardGames.resolve(CardTable)).to.be.undefined;
            expect(cardGames.resolve(Game)).to.equal(blackjack);
        });

        it("should resolve objects by class instantly", () => {
            const cashier   = new Cashier(1000000.00),
                  blackjack = new CardTable("BlackJack", 1, 5),
                  inventory = new (Handler.extend({
                      @provides(Cashier)
                      cashier() { return cashier; },
                      @provides(CardTable)
                      blackjack() { return Promise.resolve(blackjack); }                      
                  }));
            expect(inventory.resolve($instant(Cashier))).to.equal(cashier);
            expect($isPromise(inventory.resolve(CardTable))).to.be.true;
            expect(inventory.resolve($instant(CardTable))).to.be.undefined;
        });

        it("should resolve objects by protocol instantly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides(Game)
                      game() { return Promise.resolve(blackjack); }
                  }));
            expect($isPromise(cardGames.resolve(Game))).to.be.true;
            expect(cardGames.resolve($instant(Game))).to.be.undefined;
        });

        it("should resolve by string literal", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  }));
            expect(cardGames.resolve("BlackJack")).to.equal(blackjack);
        });

        it("should resolve by string literal case-insensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  }));
            expect(cardGames.resolve("BLACKJACK")).to.equal(blackjack);
        });

        it("should resolve by string literal case-sensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  }));
            expect(cardGames.resolve($eq("BLACKJACK"))).to.be.undefined;
        });
        
        it("should resolve by string instance", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  }));
            expect(cardGames.resolve(new String("BlackJack"))).to.equal(blackjack);
        });

        it("should resolve by string instance case-insensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  }));
            expect(cardGames.resolve(new String("blackjack"))).to.equal(blackjack);
        });

        it("should resolve by string instance case-sensitive", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides("BlackJack")
                      blackjack() { return blackjack; }
                  }));
            expect(cardGames.resolve($eq(new String("blackjack")))).to.be.undefined;
        });
        
        it("should resolve string by regular expression", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides(/black/i)
                      blackjack() { return blackjack; }
                  }));
            expect(cardGames.resolve("BlackJack")).to.equal(blackjack);
        });

        it("should resolve instances using instance class", () => {
            const Config = Base.extend({
                      constructor(key) {
                          this.extend({
                              get key() { return key; }
                          });
                      }
                  }), 
                  settings = new (Handler.extend({
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
                  }));
                expect(settings.resolve(new Config("user"))).to.equal("dba");
                expect(settings.resolve(new Config("name"))).to.be.undefined;
        });

        it("should resolve objects with compound keys", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cashier   = new Cashier(1000000.00),
                  cardGames = new (Handler.extend({
                      @provides(CardTable, Cashier)
                      stuff(inquiry) {
                          const key = inquiry.key;
                          if (Game.isAdoptedBy(key)) {
                              return blackjack;
                          } else if (key === Cashier) {
                              return cashier;
                          }
                      }
                  }));
            expect(cardGames.resolve(Game)).to.equal(blackjack);
            expect(cardGames.resolve(Cashier)).to.equal(cashier);
        });

        it("should unregister objects with compound keys", () => {
            const blackjack  = new CardTable("BlackJack", 1, 5),
                  cashier    = new Cashier(1000000.00),
                  cardGames  = new Handler(),
                  unregister = $provide.addHandler(cardGames, [CardTable, Cashier],
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
            const inventory = new (Handler.extend({
                @provides(Cashier)
                notHandled() { return $unhandled; }
            }));
            expect(inventory.resolve(Cashier)).to.be.undefined;
        });

        it("should resolve unknown objects", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @provides(True)
                      unknown(inquiry) {
                          if (inquiry.key === CardTable) {
                              return blackjack;
                          }
                      }
                  }));
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
            const Checkers  = Base.extend(Game),
                  inventory = new (Handler.extend({
                      @provides(constraint => constraint === PitBoss)
                      predicate() { return 0; },
                      @provides
                      anything() { return 1; },
                      @provides(Checkers)
                      anonymousType() { return 2; },
                      @provides(Level1Security)
                      type() { return 3; },
                      @provides(Activity)
                      derivedType() { return 5; },
                      @provides(Accountable)
                      baseType() { return 4; },
                      @provides(CardTable)
                      deepType() { return 6; }
                  }));
            expect(inventory.resolve(CardTable)).to.equal(6);
            expect(inventory.resolve(Activity)).to.equal(5);
            expect(inventory.resolve(Cashier)).to.equal(1);
            expect(inventory.resolve(Security)).to.equal(3);
            expect(inventory.resolve(Game)).to.equal(2);
            expect(inventory.resolve(Casino)).to.equal(1);
            expect(inventory.resolve(PitBoss)).to.equal(0);
        });
    });

    describe("#resolveAll", () => {
        it("should resolve all objects by class explicitly", done => {
            const belagio  = new Casino("Belagio"),
                  venetian = new Casino("Venetian"),
                  paris    = new Casino("Paris"),
                  strip    = belagio.next(venetian, paris);
            Promise.resolve(strip.resolveAll(Casino)).then(casinos => {
                expect(casinos).to.eql([belagio, venetian, paris]);
                done();
            });
        });

        it("should resolve all objects by class eventually", done => {
            const stop1 = [ new PitBoss("Craig"),  new PitBoss("Matthew") ],
                  stop2 = [ new PitBoss("Brenda"), new PitBoss("Lauren"), new PitBoss("Kaitlyn") ],
                  stop3 = [ new PitBoss("Phil") ],
                  bus1  = new (Handler.extend({
                      @provides(PitBoss)
                      pitBoss(inquiry) {
                          expect(inquiry.isMany).to.be.true;
                          return Promise.delay(75).then(() => stop1);
                      }
                  })),
                  bus2  = new (Handler.extend({
                      @provides(PitBoss)
                      pitBoss(inquiry) {               
                          expect(inquiry.isMany).to.be.true;
                          return Promise.delay(100).then(() => stop2);
                      }
                  })),
                  bus3  = new (Handler.extend({
                      @provides(PitBoss)
                      pitBoss(inquiry) {               
                          expect(inquiry.isMany).to.be.true;
                          return Promise.delay(50).then(() => stop3);
                      }
                  })),
                  company = bus1.next(bus2, bus3);
            Promise.resolve(company.resolveAll(PitBoss)).then(pitBosses => {
                expect(pitBosses).to.have.members($flatten([stop1, stop2, stop3]));
                done();
            });
        });

        it("should resolve all objects by class instantly", () => {
            const belagio  = new Casino("Belagio"),
                  venetian = new Casino("Venetian"),
                  paris    = new Casino("Paris"),
                  strip    = new (Handler.extend({
                      @provides(Casino)
                      venetion() { return venetian; },
                      @provides(Casino)
                      belagio() { return Promise.resolve(belagio); },
                      @provides(Casino)
                      paris() { return paris; }
                  }));
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
                  strip   = new (Handler.extend({
                      @provides(Casino)
                      casino() { return Promise.resolve(belagio); }
                  }));
            const casinos = strip.resolveAll($instant(Casino));
            expect(casinos).to.have.length(0);
        });
    });

    describe("#lookup", () => {
        it("should lookup by class", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @looksup(CardTable)
                      cardTable() { return blackjack; },
                      @looksup
                      everything() { return blackjack; }
                  }));
            expect(cardGames.lookup(CardTable)).to.equal(blackjack);
            expect(cardGames.lookup(Game)).to.be.undefined;
        });

        it("should lookup by protocol", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @looksup(Game)
                      game() { return blackjack; },
                      @looksup
                      everything() { return blackjack; }
                  }));
            expect(cardGames.lookup(Game)).to.equal(blackjack);
            expect(cardGames.lookup(CardTable)).to.be.undefined;
        });

        it("should lookup by string", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (Handler.extend({
                      @looksup("blackjack")
                      blackjack() { return blackjack; },
                      @looksup(/game/)
                      blackjack() { return blackjack; },
                  }));
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
                casino.aspect(False).handle(countMoney);
            }).to.throw(RejectedError);
        });

        it("should ignore invocation", () => {
            const guest = new Guest(21),
                  level = HandlerAdapter(new Level1Security);
            expect(() => {
                Security(level.aspect(False)).admit(guest);
            }).to.throw(RejectedError);
        });

        it("should handle callback with side-effect", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney();
            expect(casino.aspect(True, inf => inf.callback.record(-1))
                   .handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(999999.00);
        });

        it("should invoke with side-effect", () => {
            let count = 0,
                guest = new Guest(21),
                level = HandlerAdapter(new Level1Security);
            expect(Security(level.aspect(True, () => { ++count; }))
                            .admit(guest)).to.be.true;
            expect(count).to.equal(1);
        });

        it("should ignore command callback", done => {
            const cashier   = new Cashier(750000.00),
                  casino    = new Casino("Venetian").addHandlers(cashier),
                  wireMoney = new WireMoney(250000);
            Promise.resolve(casino.aspect(() => Promise.resolve(false))
                .command(wireMoney)).then(handled => {
                throw new Error("Should not get here");
            }, error => {
                expect(error).to.be.instanceOf(RejectedError);
                done();
            });
        });

        it("should ignore async invocation", done => {
            const level2 = HandlerAdapter(new Level2Security);
            Security(level2.aspect(() => {
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
            Promise.resolve(casino.aspect(True, wire => done())
                .command(wireMoney)).then(result => {
                    expect(result).to.equal(result);
                    expect(wireMoney.received).to.equal(250000);
                });
        });

        it("should invoke async with side-effect", done => {
            const level2 = HandlerAdapter(new Level2Security);
            Security(level2.aspect(True, () => done())).scan().then(scanned => {
                expect(scanned).to.be.true;
            });
        });

        it("should fail on exception in before", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(() => {
                expect(casino.aspect(() => { throw new Error; })
                       .handle(countMoney)).to.be.false;
            }).to.throw(Error);
        });

        it("should fail callback on rejection in before", done => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino("Belagio").addHandlers(cashier),
                  countMoney = new CountMoney();
            casino.aspect(() => {
                setTimeout(done, 2);
                return Promise.reject(new Error("Something bad"));
            }).command(countMoney).catch(error => {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal("Something bad");
            });
        });

        it("should fail async invoke on rejection in before", done => {
            const level2 = HandlerAdapter(new Level2Security);
            Security(level2.aspect(() => {
                setTimeout(done, 2);
                return Promise.reject(new Error("Something bad"));
            })).scan().catch(error => {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal("Something bad");
            });
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
                  security = HandlerAdapter(level1).next(level2);
            expect(Security(security).admit(guest)).to.be.false;
            Security(security).trackActivity(baccarat);
        });

        it("should compose handlers using short syntax", () => {
            const baccarat = new Activity("Baccarat"),
                  level1   = new Level1Security(),
                  level2   = new Level2Security(),
                  compose  = Handler(level1).next(level2, baccarat),
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
        const ServerOptions = Options.extend({
            url:     undefined,
            timeout: undefined
        });

        Handler.registerOptions(ServerOptions, "serverOptions");

        it("should register options", () => {
            const handler = new Handler(),
                  options = handler.getOptions(ServerOptions);
            expect(options).to.be.null;
        });

        it("should retrieve options", () => {
            const handler = new Handler().serverOptions({
                               url:     "http://localhost:3001/api",
                               timeout: 3000
                            }),
                  options = handler.getOptions(ServerOptions);
            expect(options).to.be.an.instanceof(ServerOptions);
            expect(options.url).to.equal("http://localhost:3001/api");
            expect(options.timeout).to.equal(3000);
        });

        it("should reject register if not an Options type", () => {
          expect(() => {
                Handler.registerOptions(11, "foo");
            }).to.throw(TypeError, "Options type '11' does not extend Options.");
        });

        it("should reject get if not an Options type", () => {
          expect(() => {
                (new Handler).getOptions("abc");
            }).to.throw(TypeError, "Options type 'abc' does not extend Options.");
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
                  level1 = HandlerAdapter(new Level1Security());
            expect(Security(level1).admit(guest1)).to.be.false;
            expect(Security(level1).admit(guest2)).to.be.true;
        });
        
        it("should handle async invocations", done => {
            const level2 = HandlerAdapter(new Level2Security());
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
            const gate  = new (Handler.extend(Security, {
                      admit(guest) { return true; }
                  }));
            expect(Security(gate).admit(new Guest("Me"))).to.be.true;
        });

        it("should reject if no protocol conformance", () => {
            const gate  = new (Handler.extend({
                      admit(guest) { return true; }
                  }));
            expect(() => {
                Security(gate).admit(new Guest("Me"))
            }).to.throw(Error, /admit could not be handled/);
        });

        it("should broadcast invocations", () => {
            const letItRide = new Activity("Let It Ride"),
                  level1    = new Level1Security(),
                  level2    = new Level2Security(),
                  casino    = new Casino("Treasure Island")
                  .addHandlers(level1, level2, letItRide);
            Security(casino.$broadcast()).trackActivity(letItRide);
        });

        it("should notify invocations", () => {
            const letItRide = new Activity("Let It Ride"),
                  level1    = new Level1Security(),
                  casino    = new Casino("Treasure Island")
                  .addHandlers(level1, letItRide);
            Security(casino.$notify()).trackActivity(letItRide);
        });

        it("should notify invocations", () => {
            const letItRide = new Activity("Let It Ride"),
                  level1    = new Level1Security(),
                  casino    = new Casino("Treasure Island")
                  .addHandlers(level1, letItRide);
            Security(casino.$notify()).trackActivity(letItRide);
        });

        it("should resolve target for invocation", () => {
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  }),
                  handler = Handler(new Poker()),
                  id      = Game(handler).open(5);
            expect(id).to.equal("poker5");
        });

        it("should resolve target for invocation using promise", done => {
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  }),
                  handler = new (Handler.extend({
                      @provides(Game)
                      game() { return Promise.delay(10).then(() => new Poker()); }
                  }));
            Game(handler).open(5).then(id => {
                expect(id).to.equal("poker5");
                done();
            });
        });

        it("should resolve target for invocation implicitly", () => {
            const Pumping = ResolvingProtocol.extend({
                      pump() {}
                  }),
                  Pump = Base.extend(Pumping, {
                      pump() { return 5; }
                  }),
                  handler = new Handler();
            $provide.addHandler(handler, new Pump());
            expect(Pumping(handler).pump()).to.equal(5);
        });
        
        it("should fail invocation if unable to resolve", () => {
            const handler = new Handler();
            expect(() => {
                Game(handler).open(4);
            }).to.throw(TypeError, /open could not be handled/);
        });

        it("should fail invocation if method not found", () => {
            const Poker   = Base.extend(Game),
                  handler = Handler(new Poker());
            expect(() => {
                Game(handler).open(4);
            }).to.throw(TypeError, /open could not be handled/);
        });

        it("should fail invocation promise if method not found", done => {
            const Poker   = Base.extend(Game),
                  handler = new (Handler.extend({
                      @provides(Game)
                      game() { return Promise.delay(10).then(() => new Poker()); }
                  }));
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
            const handler = new (Handler.extend({
                @provides(Game)
                game() { return Promise.delay(10).then(() => $unhandled); }
              }));
            Game(handler.$bestEffort()).open(5).then(id => {
                expect(id).to.be.undefiend;
                done();
            });            
        });
        
        it("should resolve all targets or invocation", () => {
            let   count = 0;
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  }),
                  Slots = Base.extend(Game, {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  }),                
                  handler = new CascadeHandler(new Poker(), new Slots()),
                  id      = Game(handler.$broadcast()).open(5);
            expect(id).to.equal("poker5");
            expect(count).to.equal(2);
        }).timeout(10000);

        it("should resolve all targets or invocation using promise", done => {
            let   count = 0;
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  }),
                  Slots = Base.extend(Game, {
                      open(numPlayers) {
                          ++count;
                          return "poker" + numPlayers;
                      }
                  }),
                  handler = new CascadeHandler(
                      new (Handler.extend({
                          @provides(Game)
                          game() { return Promise.delay(10).then(() => new Poker()); }
                      })),
                      new (Handler.extend({
                          @provides(Game)
                          game() { return Promise.delay(5).then(() => new Slots()); }
                      }))
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
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  }),
                  handler = Handler(new Poker());
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
          Offline = Emailing.extend(),
          EmailHandler = Handler.extend(Emailing, {
              send(msg) {
                  const batch = this.ensureBatch();
                  return batch ? batch.send(msg) : msg; 
              },
              sendConfirm(msg) {
                  const batch = this.ensureBatch();
                  return batch ? batch.sendConfirm(msg)
                       : Promise.resolve(msg);
              },
              fail(msg) {
                  if (msg === "OFF") {
                      return Offline($composer).fail(msg);
                  }
                  throw new Error("Can't send message");
              },
              failConfirm(msg) {
                  const batch = this.ensureBatch();
                  return batch ? batch.failConfirm(msg)
                       : Promise.reject(Error("Can't send message"));
              },            
              ensureBatch() {
                  const batch = $composer.getBatch(Emailing);
                  if (batch) {
                      const emailBatch = new EmailBatch();
                      batch.addHandlers(emailBatch);
                      return emailBatch;
                  }
              }
          }),
          OfflineHandler = Handler.extend(Offline, {
              send(msg) { return 99; },
              sendConfirm(msg) {
                  throw new Error("Can't confirm message offline");
              },            
              fail(msg) { return -1; },
              failConfirm(msg) {}
          }),
          DemoHandler = Handler.extend({
              send(msg) { return msg; },
              sendConfirm(msg) { return Promise.resolve(msg); },            
              fail(msg) {},
              failConfirm(msg) {}
          });    
        const EmailBatch = Base.extend(Emailing, Batching, {
            constructor() {
                _(this).msgs     = [];
                _(this).resolves = [];
                _(this).promises = [];
            },

            send(msg) {
                _(this).msgs.push(msg + " batch");
            },
            sendConfirm(msg) {
                const { msgs, resolves, promises } = _(this);
                msgs.push(msg);
                const promise = new Promise(resolve =>
                    resolves.push(() => { resolve(msg + " batch"); })
                );
                promises.push(promise);
                return promise;
            },
            failConfirm(msg) {
                const { resolves, promises } = _(this);
                const promise = new Promise((resolve, reject) =>
                    resolves.push(() => { reject(Error("Can't send message")); })
                );
                promises.push(promise);
                return promise;
            },
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
        });

    it("should require protocol conformance", () => {
        const handler = new DemoHandler();
        expect(() => Emailing(handler).send("Hello")).to.throw(Error, /send could not be handled/);
    });

    it("should require protocol invariance", () => {
        const handler = new DemoHandler();
        expect(() => Offline(handler).send("Hello")).to.throw(Error, /send could not be handled/);
    });

    it("should handle methods covariantly", () => {
        const handler = new OfflineHandler();
        expect(Emailing(handler).fail("Hello")).to.equal(-1);         
    });

    it("should handle methods polymorphically", () => {
        const handler = new EmailHandler().next(new OfflineHandler());
        expect(Emailing(handler).fail("OFF")).to.equal(-1);         
    });
    
    it("should handle methods strictly", () => {
        const handler = new OfflineHandler();
        expect(() => Emailing(handler.$strict()).send("Hello")).to.throw(Error, /send could not be handled/);
    });

    it("should chain handle methods strictly", () => {
         const handler = new OfflineHandler().next(new EmailHandler());
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
            const bank = (new (Handler.extend({
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }
                  }))),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50).command(wireMoney)).catch(err => {
                expect(err).to.be.instanceOf(TimeoutError);
                done();
            });
        });

        it("should ignore time out if promise resolved", done => {
            const bank = (new (Handler.extend({
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(50).then(() => wireMoney);
                      }
                  }))),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(100).command(wireMoney)).then(result => {
                expect(result).to.equal(wireMoney);
                expect(wireMoney.received).to.equal(50000);
                done();
            });
        });
        
        it("should reject promise with error instance", done => {
            const bank = (new (Handler.extend({
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }                
                  }))),
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
            const bank = (new (Handler.extend({
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }                
                  }))),
                  casino    = new Casino("Venetian").addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50, BankError)
                            .command(wireMoney)).catch(err => {
                expect(err).to.be.instanceOf(BankError);
                expect(err.callback.callback.callback).to.equal(wireMoney);
                done();
            });
        });

        it("should propogate errors", done => {
            const bank = (new (Handler.extend({
                      @handles(WireMoney)
                      wireMoney(wireMoney) {
                          return Promise.reject(new Error("No money"))                    
                      }                
                  }))),
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
                expect(Emailing(batch.noBatch()).send("Hello")).to.equal("Hello");
                done();
            })).to.eql([]);
        });

        it("should work with filters", () => {
            let   count   = 0;
            const handler = new EmailHandler(),
                  batch   = handler.aspect(null, () => {
                      ++count;
                  }).$batch();
            expect($using(batch, () => {
                expect(Emailing(batch).send("Hello")).to.be.undefined;
            })).to.eql([["Hello batch"]]);
            expect(count).to.equal(2);
        });        
    });
});

