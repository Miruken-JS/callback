import {
    HandleMethod, RejectedError, TimeoutError,
    $composer
} from '../src/callbacks';

import {
    CallbackHandler, CascadeCallbackHandler,
    CompositeCallbackHandler
} from '../src/handlers';

import {
    $define, $handle, $provide, $lookup, $callbacks,
    $NOT_HANDLED
} from '../src/meta'

import { handle, provide } from '../src/decorators';
import { Batching } from '../src/batch';
import '../src/invocation';

import {
    True, False, Undefined, Base, Protocol,
    StrictProtocol, Variance, Resolving,
    assignID, copy, $meta, $isPromise, $eq,
    $copy, $instant, $using, $flatten
} from 'miruken-core';

import { expect } from 'chai';

const Guest = Base.extend({
    $properties: {
        age: 0
    },
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
    $properties: {
        name: ''
    },
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
    $properties: {
        requested: 0.0,
        received:  0.0
    },
    constructor(requested) {
        this.requested = requested;
    }
});

const CountMoney = Base.extend({
    constructor() {
        let _total = 0.0;
        this.extend({
            get total() { return _total; },
            record(amount) { _total += amount; }
        });
    }
});

const Accountable = Base.extend($callbacks, {
    constructor(assets, liabilities) {
        assets      = Number(assets || 0);
        liabilities = Number(liabilities || 0);
        this.extend({
            get assets() { return assets; },
            get liabilities() { return liabilities; },
            get balance() { return assets - liabilities; },
            addAssets(amount) { assets      += amount; },
            addLiabilities(amount) { liabilities += amount; },
            transfer(amount, receiver) {
                assets -= amount;
                if (assets < 0) {
                    liabilties -= assets;
                    assets      = 0;
                }
                receiver.addAssets(amount);
                return Promise.delay(100);
            }
        });
    },
    @handle(CountMoney)
    countMoney(countMoney, composer) {
        countMoney.record(this.balance);        
    }
});

const Cashier = Accountable.extend({
    @handle(WireMoney)
    wireMoney(wireMoney) {
        wireMoney.received = wireMoney.requested;
        return Promise.resolve(wireMoney);        
    },
    toString() { return 'Cashier $' + this.balance; }
});

const Activity = Accountable.extend({
    $properties: {
        name: ''
    },
    constructor(name) {
        this.base();
        this.name = name;
    },
    toString() { return 'Activity ' + this.name; }
});

const CardTable = Activity.extend(Game, {
    constructor(name, minPlayers, maxPlayers) {
        this.base(name);
        this.extend({
            open(numPlayers) {
                if (minPlayers > numPlayers || numPlayers > maxPlayers)
                    return $NOT_HANDLED;
            },
        });
    }
});

const Casino = CompositeCallbackHandler.extend({
    $properties: {
        name: ''
    },
    constructor(name) {
        this.base();
        this.name = name;
    },
    @provide(PitBoss)
    pitBoss() { return new PitBoss('Freddy'); },
    @provide(DrinkServer)
    drinkServer() {
        return Promise.delay(100).then(() => new DrinkServer());
    },
    toString() { return 'Casino ' + this.name; },
});

describe("HandleMethod", () => {
    describe("#getType", () => {
        it("should get the method type", () => {
            const method = new HandleMethod(HandleMethod.Invoke, undefined, "deal", [[1,3,8], 2]);
            expect(method.type).to.equal(HandleMethod.Invoke);
        });
    });

    describe("#getMethodName", () => {
        it("should get the method name", () => {
            const method = new HandleMethod(HandleMethod.Invoke, undefined, "deal", [[1,3,8], 2]);
            expect(method.methodName).to.equal("deal");
        });
    });

    describe("#getArguments", () => {
        it("should get the method arguments", () => {
            const method = new HandleMethod(HandleMethod.Invoke, undefined, "deal", [[1,3,8], 2]);
            expect(method.arguments).to.eql([[1,3,8], 2]);
        });

        it("should be able to change arguments", () => {
            const method = new HandleMethod(HandleMethod.Invoke, undefined, "deal", [[1,3,8], 2]);
            method.arguments[0] = [2,4,8];
            expect(method.arguments).to.eql([[2,4,8], 2]);
        });
    });

    describe("#getReturnValue", () => {
        it("should get the return value", () => {
            const method = new HandleMethod(HandleMethod.Invoke, undefined, "deal", [[1,3,8], 2]);
            method.returnValue = [1,8];
            expect(method.returnValue).to.eql([1,8]);
        });
    });

    describe("#setReturnValue", () => {
        it("should set the return value", () => {
            const method = new HandleMethod(HandleMethod.Invoke, undefined, "deal", [[1,3,8], 2]);
            method.returnValue = [1,8];
            expect(method.returnValue).to.eql([1,8]);
        });
    });

    describe("#invokeOn", () => {
        it("should invoke method on target", () => {
            const dealer  = new Dealer(),
                  method  = new HandleMethod(HandleMethod.Invoke, undefined, "shuffle", [[22,19,9,14,29]]),
                  handled = method.invokeOn(dealer);
            expect(handled).to.be.true;
            expect(method.returnValue).to.have.members([22,19,9,14,29]);
        });

        it("should call getter on target", () => {
            const guest   = new Guest(12),
                  method  = new HandleMethod(HandleMethod.Get, undefined, "age"),
                  handled = method.invokeOn(guest);
            expect(handled).to.be.true;
            expect(method.returnValue).to.equal(12);
        });

        it("should call setter on target", () => {
            const guest   = new Guest(12),
                  method  = new HandleMethod(HandleMethod.Set, undefined, "age", 18),
                  handled = method.invokeOn(guest);
            expect(handled).to.be.true;
            expect(method.returnValue).to.equal(18);
            expect(guest.age).to.equal(18);
        });
    });
});

describe("Definitions", () => {
    describe("$define", () => {
        it("should require non-empty tag", () => {
            $define('$foo');
            expect(() => {
                $define();
            }).to.throw(Error, "The tag must be a non-empty string with no whitespace.");
            expect(() => {
                $define("");
            }).to.throw(Error, "The tag must be a non-empty string with no whitespace.");
            expect(() => {
                $define("  ");
            }).to.throw(Error, "The tag must be a non-empty string with no whitespace.");
        });

        it("should prevent same tag from being registered", () => {
            $define('$bar');
            expect(() => {
                $define('$bar');
            }).to.throw(Error, "'$bar' is already defined.");
        });

        it("Should accept variance option", () => {
            const baz = $define('$baz', Variance.Contravariant);
        expect(baz).to.be.ok;
        });

        it("Should reject invalid variance option", () => {
            expect(() => {
        $define('$buz', { variance: 1000 });
            }).to.throw(TypeError, "Invalid variance type supplied");
        });
    });

    describe("#list", () => {
        it("should create $meta($handle) key when first handler registered", () => {
            const handler  = new CallbackHandler();
            $handle(handler, True, True);
            expect($meta(handler).$handle).to.be.ok;
        });

        it("should maintain linked-list of handlers", () => {
            const handler = new CallbackHandler();
            $handle(handler, Activity, Undefined);
            $handle(handler, Accountable, Undefined);
            $handle(handler, Game, Undefined);
            expect($meta(handler).$handle.head.constraint).to.equal(Activity);
            expect($meta(handler).$handle.head.next.constraint).to.equal(Accountable);
            expect($meta(handler).$handle.tail.prev.constraint).to.equal(Accountable);
            expect($meta(handler).$handle.tail.constraint).to.equal(Game);
        });

        it("should order $handle contravariantly", () => {
            const handler = new CallbackHandler();
            $handle(handler, Accountable, Undefined);
            $handle(handler, Activity, Undefined);
            expect($meta(handler).$handle.head.constraint).to.equal(Activity);
            expect($meta(handler).$handle.tail.constraint).to.equal(Accountable);
        });

        it("should order $handle invariantly", () => {
            const handler = new CallbackHandler();
            $handle(handler, Activity, Undefined);
            $handle(handler, Activity, True);
            expect($meta(handler).$handle.head.handler).to.equal(Undefined);
            expect($meta(handler).$handle.tail.handler).to.equal(True);
        });

        it("should order $provide covariantly", () => {
            const handler = new CallbackHandler();
            $provide(handler, Activity, Undefined);
            $provide(handler, Accountable, Undefined);
            expect($meta(handler).$provide.head.constraint).to.equal(Accountable);
            expect($meta(handler).$provide.tail.constraint).to.equal(Activity);
        });

        it("should order $provide invariantly", () => {
            const handler = new CallbackHandler();
            $provide(handler, Activity, Undefined);
            $provide(handler, Activity, True);
            expect($meta(handler).$provide.head.handler).to.equal(Undefined);
            expect($meta(handler).$provide.tail.handler).to.equal(True);
        });

        it("should order $lookup invariantly", () => {
            const handler = new CallbackHandler();
            $lookup(handler, Activity, Undefined);
            $lookup(handler, Activity, True);
            expect($meta(handler).$lookup.head.handler).to.equal(Undefined);
            expect($meta(handler).$lookup.tail.handler).to.equal(True);
        });

        it("should index first registered handler with head and tail", () => {
            const handler  = new CallbackHandler,
                unregister = $handle(handler, True, Undefined);
            expect(unregister).to.be.a('function');
            expect($meta(handler).$handle.head.handler).to.equal(Undefined);
            expect($meta(handler).$handle.tail.handler).to.equal(Undefined);
        });

        it("should call function when handler removed", () => {
            let handler        = new CallbackHandler,
                handlerRemoved = false,
                unregister     = $handle(handler, True, Undefined, () => {
                    handlerRemoved = true;
                });
            unregister();
            expect(handlerRemoved).to.be.true;
            expect($meta(handler).$handle).to.be.undefined;
        });

        it("should suppress handler removed if requested", () => {
            let handler        = new CallbackHandler,
                handlerRemoved = false,
                unregister     = $handle(handler, True, Undefined, () => {
                    handlerRemoved = true;
                });
            unregister(false);
            expect(handlerRemoved).to.be.false;
            expect($meta(handler).$handle).to.be.undefined;
        });

        it("should remove $handle when no handlers remain", () => {
            const handler    = new CallbackHandler,
                  unregister = $handle(handler, True, Undefined);
            unregister();
            expect($meta(handler).$handle).to.be.undefined;
        });
    });

    describe("#index", () => {
        it("should index class constraints using assignID", () => {
            const handler = new CallbackHandler,
                  index   = assignID(Activity);
            $handle(handler, Activity, Undefined);
            expect($meta(handler).$handle.getIndex(index).constraint).to.equal(Activity);
        });

        it("should index protocol constraints using assignID", () => {
            const handler   = new CallbackHandler,
                  index     = assignID(Game);
            $handle(handler, Game, Undefined);
            expect($meta(handler).$handle.getIndex(index).constraint).to.equal(Game);
        });

        it("should index string constraints using string", () => {
            const handler   = new CallbackHandler();
            $handle(handler, "something", Undefined);
            expect($meta(handler).$handle.getIndex("something").handler).to.equal(Undefined);
        });

        it("should move index to next match", () => {
            let handler     = new CallbackHandler,
                index       = assignID(Activity),
                unregister  = $handle(handler, Activity, Undefined);
            $handle(handler, Activity, True);
            expect($meta(handler).$handle.getIndex(index).handler).to.equal(Undefined);
            unregister();
            expect($meta(handler).$handle.getIndex(index).handler).to.equal(True);
        });

        it("should remove index when no more matches", () => {
            const handler   = new CallbackHandler,
                  index     = assignID(Activity);
            $handle(handler, Accountable, Undefined);
            const unregister  = $handle(handler, Activity, Undefined);
            unregister();
            expect($meta(handler).$handle.getIndex(index)).to.be.undefined;
        });
    });

    describe("#removeAll", () => {
        it("should remove all $handler definitions", () => {
            let handler     = new CallbackHandler,
                removeCount = 0,
                removed     = () => { ++removeCount; };
            $handle(handler, Accountable, Undefined, removed);
            $handle(handler, Activity, Undefined, removed);
        $handle.removeAll(handler);
        expect(removeCount).to.equal(2);
            expect($meta(handler).$handle).to.be.undefined;
        });

        it("should remove all $provider definitions", () => {
            let handler     = new CallbackHandler,
                removeCount = 0,
                removed     = () => { ++removeCount; };
            $provide(handler, Activity, Undefined, removed);
            $provide(handler, Accountable, Undefined, removed);
        $provide.removeAll(handler);
        expect(removeCount).to.equal(2);
            expect($meta(handler).$provide).to.be.undefined;
        });
    });
});

describe("CallbackHandler", () => {
    describe("#handle", () => {
        it("should not handle nothing", () => {
            const casino   = new Casino();
            expect(casino.handle()).to.be.false;
            expect(casino.handle(null)).to.be.false;
        });

        it("should not handle anonymous objects", () => {
            const casino   = new Casino();
            expect(casino.handle({name:'Joe'})).to.be.false;
        });

        it("should handle callbacks", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino('Belagio').addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(casino.handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(1000000.00);
        });

        it("should handle callbacks per instance", () => {
            const cashier    = new Cashier(1000000.00),
                  handler    = new CallbackHandler();
            $handle(handler, Cashier, function (cashier) {
                this.cashier = cashier;
            });
            expect(handler.handle(cashier)).to.be.true;
            expect(handler.cashier).to.equal(cashier);
        });

        it("should handle callback hierarchy", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (CallbackHandler.extend({
                      @handle(Accountable)
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  }));
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
        });

        it("should ignore callback if $NOT_HANDLED", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (CallbackHandler.extend({
                      @handle(Cashier)
                      ignore(cashier) { return $NOT_HANDLED; }
                  }));
            expect(inventory.handle(cashier)).to.be.false;
        });

        it("should handle callback invariantly", () => {
            const cashier     = new Cashier(1000000.00),
                  accountable = new Accountable(1.00),
                  inventory   = new (CallbackHandler.extend({
                      @handle($eq(Accountable))
                      account(accountable) {
                          this.accountable = accountable;                          
                      }
                  }));
            expect(inventory.handle(cashier)).to.be.false;
            expect(inventory.handle(accountable)).to.be.true;
            expect(inventory.accountable).to.equal(accountable);
            $handle(inventory, Accountable, function (accountable) {
                this.accountable = accountable;
            });
            expect(inventory.handle(cashier)).to.be.true;
            expect(inventory.accountable).to.equal(cashier);
        });

        it("should stop early if handle callback invariantly", () => {
            const cashier     = new Cashier(1000000.00),
                  accountable = new Accountable(1.00),
                  inventory   = new (CallbackHandler.extend({
                      $handle:[
                          Accountable, Undefined,
                          null, Undefined]
                  }));
            expect(inventory.handle($eq(accountable))).to.be.true;
            expect(inventory.handle($eq(cashier))).to.be.false;
        });

        it("should handle callback protocol conformance", () => {
            const blackjack  = new CardTable('Blackjack'),
                  inventory  = new (CallbackHandler.extend({
                      @handle(Game)
                      play(game) {
                          this.game = game;
                      }
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.game).to.equal(blackjack);
        });

        it("should prefer callback hierarchy over protocol conformance", () => {
            const blackjack  = new CardTable('Blackjack'),
                  inventory  = new (CallbackHandler.extend({
                      @handle(Activity)
                      activity(activity) {
                          this.activity = activity;
                      },
                      @handle(Game)
                      play(game) {
                          this.game = game;
                      }                      
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.activity).to.equal(blackjack);
            expect(inventory.game).to.be.undefined;
        });

        it("should prefer callback hierarchy and continue with protocol conformance", () => {
            const blackjack  = new CardTable('Blackjack'),
                  inventory  = new (CallbackHandler.extend({
                      @handle(Activity)
                      activity(activity) {
                          this.activity = activity;
                          return false;
                      },
                      @handle(Game)
                      play(game) {
                          this.game = game;
                      }                      
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(inventory.activity).to.equal(blackjack);
            expect(inventory.game).to.equal(blackjack);
        });

        it("should handle unknown callback", () => {
            const blackjack = new CardTable('Blackjack'),
                  inventory = new (CallbackHandler.extend({
                      @handle
                      everything(callback) {
                          callback.check = true;
                      }
                  }));
            expect(inventory.handle(blackjack)).to.be.true;
            expect(blackjack.check).to.be.true;
        });

        it("should handle unknown callback via delegate", () => {
            const blackjack = new CardTable('Blackjack'),
                  inventory = new (Base.extend($callbacks, {
                      @handle
                      everything(callback) {
                          callback.check = true;
                      }
                  })),
                  casino   = new Casino('Belagio').addHandlers(inventory);
            expect(casino.handle(blackjack)).to.be.true;
            expect(blackjack.check).to.be.true;
        });

        it("should allow handlers to chain to base", () => {
            const blackjack = new CardTable('Blackjack'),
                  Tagger    = CallbackHandler.extend({
                      @handle(Activity)
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
                inventory = new (CallbackHandler.extend({
                    @handle(c => c === PitBoss)
                    pitBoss() { matched = 0; },
                    @handle
                    anything() { matched = 1; },
                    @handle(Game)
                    game() { matched = 2; },
                    @handle(Security)
                    security() { matched = 3; },
                    @handle(Activity)
                    activity() { matched = 5; },
                    @handle(Accountable)
                    accountable() { matched = 4; },
                    @handle(CardTable)
                    cardTable() { matched = 6; }
                }));
            inventory.handle(new CardTable('3 Card Poker'));
            expect(matched).to.equal(6);
            inventory.handle(new Activity('Video Poker'));
            expect(matched).to.equal(5);
            inventory.handle(new Cashier(100));
            expect(matched).to.equal(4);
            inventory.handle(new Level1Security);
            expect(matched).to.equal(3);
            inventory.handle(new Checkers);
            expect(matched).to.equal(2);
            inventory.handle(new Casino('Paris'));
            expect(matched).to.equal(1);
            inventory.handle(new PitBoss('Mike'));
            expect(matched).to.equal(0);
        });

        it("should handle callbacks greedy", () => {
            const cashier   = new Cashier(1000000.00),
                  blackjack = new Activity('Blackjack'),
                  casino    = new Casino('Belagio')
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
                  handler    = CallbackHandler.accepting(countMoney => {
                      countMoney.record(50);
                  }, CountMoney);
            expect(handler.handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(50);
        });

        it("should handle compound keys", () => {
            const cashier   = new Cashier(1000000.00),
                  blackjack = new Activity('Blackjack'),
                  bank      = new (Accountable.extend()),
                  inventory = new (CallbackHandler.extend({
                      @handle(Cashier, Activity)
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
                  blackjack  = new Activity('Blackjack'),
                  bank       = new (Accountable.extend()),
                  inventory  = new CallbackHandler,
                  unregister = $handle(inventory, [Cashier, Activity], function (accountable) {
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

    describe("#defer", () => {
        it("should handle objects eventually", done => {
            const cashier   = new Cashier(750000.00),
                  casino    = new Casino('Venetian').addHandlers(cashier),
                  wireMoney = new WireMoney(250000);
            Promise.resolve(casino.defer(wireMoney)).then(handled => {
                expect(handled).to.be.true;
                expect(wireMoney.received).to.equal(250000);
                done();
            });
        });

        it("should handle objects eventually with promise", done => {
            const bank = (new (CallbackHandler.extend({
                        @handle(WireMoney)
                        wireMoney(wireMoney) {
                            wireMoney.received = 50000;
                            return Promise.delay(100).then(() => wireMoney);
                        }
                  }))),
                  casino    = new Casino('Venetian').addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.defer(wireMoney)).then(handled => {
                expect(handled).to.be.true;
                expect(wireMoney.received).to.equal(50000);
                done();
            });
        });

        it("should handle callbacks anonymously with promise", done => {
            const handler = CallbackHandler.accepting(
                    countMoney => countMoney.record(50), CountMoney),
                  countMoney = new CountMoney();
            Promise.resolve(handler.defer(countMoney)).then(handled => {
                expect(handled).to.be.true;
                expect(countMoney.total).to.equal(50);
                done();
            });
        });
    });

    describe("#resolve", () => {
        it("should resolve explicit objects", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (CallbackHandler.extend({
                      @provide(Cashier)
                      cashier() { return cashier; }
                  }));
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });

        it("should infer constraint from explicit objects", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new CallbackHandler();
            $provide(inventory, cashier);
            expect(inventory.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve copy of object with $copy", () => {
            const Circle = Base.extend({
                      constructor(radius) {
                          this.radius = radius;
                      },
                      copy() {
                          return new Circle(this.radius);
                      }
                  }),
                  circle = new Circle(2),
                  shapes = new (CallbackHandler.extend({
                      @copy
                      @provide(Circle)                      
                      circle() { return circle; }
                  })),
                  shapesG = new (CallbackHandler.extend({
                      @copy
                      @provide(Circle)                      
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
                  casino  = new Casino('Belagio').addHandlers(cashier);
            expect(casino.resolve(Casino)).to.equal(casino);
            expect(casino.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve objects by protocol implicitly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  casino    = new Casino('Belagio').addHandlers(blackjack);
            expect(casino.resolve(Game)).to.equal(blackjack);
        });

        it("should resolve objects by class explicitly", () => {
            const casino  = new Casino('Belagio'),
                  pitBoss = casino.resolve(PitBoss);
            expect(pitBoss).to.be.an.instanceOf(PitBoss);
        });

        it("should resolve objects by per instance", () => {
            const cashier  = new Cashier(1000000.00),
                  provider = new CallbackHandler();
            $provide(provider, Cashier, () => cashier);
            expect(provider.resolve(Cashier)).to.equal(cashier);
        });

        it("should resolve objects by class invariantly", () => {
            const cashier   = new Cashier(1000000.00),
                  inventory = new (CallbackHandler.extend({
                      $provide:[
                          $eq(Cashier), () => cashier
                      ]
                  }));
            expect(inventory.resolve(Accountable)).to.be.undefined;
            expect(inventory.resolve(Cashier)).to.equal(cashier);
            $provide(inventory, Cashier, resolution => cashier);
            expect(inventory.resolve(Accountable)).to.equal(cashier);
        });

        it("should resolve objects by protocol invariantly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $provide:[
                          $eq(Game), () => blackjack
                      ]
                  }));
            expect(cardGames.resolve(CardTable)).to.be.undefined;
            expect(cardGames.resolve(Game)).to.equal(blackjack);
        });

        it("should resolve objects by class instantly", () => {
            const cashier   = new Cashier(1000000.00),
                  blackjack = new CardTable("BlackJack", 1, 5),
                  inventory = new (CallbackHandler.extend({
                      $provide:[
                          Cashier, () => cashier,
                          CardTable, () => Promise.resolve(blackjack)
                      ]
                  }));
            expect(inventory.resolve($instant(Cashier))).to.equal(cashier);
            expect($isPromise(inventory.resolve(CardTable))).to.be.true;
            expect(inventory.resolve($instant(CardTable))).to.be.undefined;
        });

        it("should resolve objects by protocol instantly", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $provide:[
                          Game, () => Promise.resolve(blackjack)
                      ]
                  }));
            expect($isPromise(cardGames.resolve(Game))).to.be.true;
            expect(cardGames.resolve($instant(Game))).to.be.undefined;
        });

        it("should resolve by string literal", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $provide:[
                          'BlackJack', () =>  blackjack
                      ]
                  }));
            expect(cardGames.resolve('BlackJack')).to.equal(blackjack);
        });

        it("should resolve by string instance", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                     $provide:[
                         'BlackJack', () =>  blackjack
                     ]
                  }));
            expect(cardGames.resolve(new String("BlackJack"))).to.equal(blackjack);
        });

        it("should resolve string by regular expression", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $provide:[
                          /black/i, () =>  blackjack
                      ]
                  }));
            expect(cardGames.resolve('BlackJack')).to.equal(blackjack);
        });

        it("should resolve instances using instance class", () => {
            const Config = Base.extend({
                      constructor(key) {
                          this.extend({
                              get key() { return key; }
                          });
                      }
                  }), 
                  settings = new (CallbackHandler.extend({
                      $provide:[
                          Config, resolution => {
                              const config = resolution.key,
                                    key    = config.key;
                              if (key == "url") {
                                  return "my.server.com";
                              } else if (key == "user") {
                                  return "dba";
                              }
                          }]
                  }));
                expect(settings.resolve(new Config("user"))).to.equal("dba");
                expect(settings.resolve(new Config("name"))).to.be.undefined;
        });

        it("should resolve objects with compound keys", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cashier   = new Cashier(1000000.00),
                  cardGames = new (CallbackHandler.extend({
                      $provide:[
                          [CardTable, Cashier], resolution => {
                              const key = resolution.key;
                              if (key.conformsTo(Game)) {
                                  return blackjack;
                              } else if (key === Cashier) {
                                  return cashier;
                              }
                          }]
                  }));
            expect(cardGames.resolve(Game)).to.equal(blackjack);
            expect(cardGames.resolve(Cashier)).to.equal(cashier);
        });

        it("should unregister objects with compound keys", () => {
            const blackjack  = new CardTable("BlackJack", 1, 5),
                  cashier    = new Cashier(1000000.00),
                  cardGames  = new CallbackHandler(),
                  unregister = $provide(cardGames, [CardTable, Cashier], resolution => {
                      const key = resolution.key;
                      if (key.conformsTo(Game)) {
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
            const something = new CallbackHandler();
            expect(something.resolve(Cashier)).to.be.undefined;
        });

        it("should not resolve objects if $NOT_HANDLED", () => {
            const inventory = new (CallbackHandler.extend({
                      $provide:[
                          Cashier, resolution => $NOT_HANDLED]
                  }));
            expect(inventory.resolve(Cashier)).to.be.undefined;
        });

        it("should resolve unknown objects", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $provide:[
                          True, resolution => {
                              if (resolution.key === CardTable) {
                                  return blackjack;
                              }
                          }]
                  }));
            expect(cardGames.resolve(CardTable)).to.equal(blackjack);
            expect(cardGames.resolve(Game)).to.be.undefined;
        });

        it("should resolve objects by class eventually", done => {
            const casino = new Casino('Venetian');
            Promise.resolve(casino.resolve(DrinkServer)).then(server => {
                expect(server).to.be.an.instanceOf(DrinkServer);
                done();
            });
        });

        it("should not resolve by string", () => {
            const casino = new Casino('Venetian');
            expect(casino.resolve("slot machine")).to.be.undefined;
        });

        it("should resolve with precedence rules", () => {
            const Checkers  = Base.extend(Game),
                  inventory = new (CallbackHandler.extend({
                      $provide:[
                          constraint => constraint === PitBoss,() => 0,
                          null, () => 1,
                          Checkers, () => 2,
                          Level1Security, () => 3,
                          Activity, () => 5,
                          Accountable, () => 4,
                          CardTable, () => 6
                          ]
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
            const belagio  = new Casino('Belagio'),
                  venetian = new Casino('Venetian'),
                  paris    = new Casino('Paris'),
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
                  bus1  = new (CallbackHandler.extend({
                      $provide:[ PitBoss, resolution => {
                          expect(resolution.isMany).to.be.true;
                          return Promise.delay(75).then(() => stop1);
                      }]
                  })),
                  bus2  = new (CallbackHandler.extend({
                      $provide:[ PitBoss, resolution => {
                          expect(resolution.isMany).to.be.true;
                          return Promise.delay(100).then(() => stop2);
                      }]
                  })),
                  bus3  = new (CallbackHandler.extend({
                      $provide:[ PitBoss, resolution => {
                          expect(resolution.isMany).to.be.true;
                          return Promise.delay(50).then(() => stop3);
                      }]
                  })),
                  company = bus1.next(bus2, bus3);
            Promise.resolve(company.resolveAll(PitBoss)).then(pitBosses => {
                expect(pitBosses).to.eql($flatten([stop1, stop2, stop3]));
                done();
            });
        });

        it("should resolve all objects by class instantly", () => {
            const belagio  = new Casino('Belagio'),
                  venetian = new Casino('Venetian'),
                  paris    = new Casino('Paris'),
                  strip    = new (CallbackHandler.extend({
                      $provide:[
                          Casino, () => venetian,
                          Casino, () => Promise.resolve(belagio),
                          Casino, () => paris
                      ]
                  }));
            const casinos = strip.resolveAll($instant(Casino));
            expect(casinos).to.eql([venetian, paris]);
        });

        it("should return empty array if none resolved", done => {
            Promise.resolve((new CallbackHandler).resolveAll(Casino)).then(casinos => {
                expect(casinos).to.have.length(0);
                done();
            });
        });

        it("should return empty array instantly if none resolved", () => {
            const belagio = new Casino('Belagio'),
                  strip   = new (CallbackHandler.extend({
                      $provide:[
                          Casino, () => Promise.resolve(belagio)
                      ]
                  }));
            const casinos = strip.resolveAll($instant(Casino));
            expect(casinos).to.have.length(0);
        });
    });

    describe("#lookup", () => {
        it("should lookup by class", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $lookup:[
                          CardTable, () => blackjack,
                          null, () => blackjack
                      ]
                  }));
            expect(cardGames.lookup(CardTable)).to.equal(blackjack);
            expect(cardGames.lookup(Game)).to.be.undefined;
        });

        it("should lookup by protocol", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $lookup:[
                          Game, () => blackjack, 
                          null, () => blackjack
                      ]
                  }));
            expect(cardGames.lookup(Game)).to.equal(blackjack);
            expect(cardGames.lookup(CardTable)).to.be.undefined;
        });

        it("should lookup by string", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = new (CallbackHandler.extend({
                      $lookup:[
                          'blackjack', () => blackjack,
                              /game/, () => blackjack,
                      ]
                  }));
            expect(cardGames.lookup('blackjack')).to.equal(blackjack);
            expect(cardGames.lookup('game')).to.be.undefined;
        });
    });

    describe("#filter", () => {
        it("should accept callback", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino('Belagio').addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(casino.filter((cb, cm, proceed) => proceed())
                   .handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(1000000.00);
        });

        it("should reject callback", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino('Belagio').addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(casino.filter(False).handle(countMoney)).to.be.false;
        });

        it("should ignore filter when reentrant", () => {
            const cashier      = new Cashier(1000000.00),
                  casino       = new Casino('Belagio').addHandlers(cashier),
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
                  casino     = new Casino('Belagio').addHandlers(cashier),
                  countMoney = new CountMoney();
            expect(() => {
                casino.aspect(False).handle(countMoney);
            }).to.throw(RejectedError);
        });

        it("should ignore invocation", () => {
            const guest = new Guest(21),
                  level = CallbackHandler(new Level1Security);
            expect(() => {
                Security(level.aspect(False)).admit(guest);
            }).to.throw(RejectedError);
        });

        it("should handle callback with side-effect", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino('Belagio').addHandlers(cashier),
                  countMoney = new CountMoney();
            expect(casino.aspect(True, countIt => countIt.record(-1))
                   .handle(countMoney)).to.be.true;
            expect(countMoney.total).to.equal(999999.00);
        });

        it("should invoke with side-effect", () => {
            let count = 0,
                guest = new Guest(21),
                level = CallbackHandler(new Level1Security);
            expect(Security(level.aspect(True, () => { ++count; }))
                            .admit(guest)).to.be.true;
            expect(count).to.equal(1);
        });

        it("should ignore deferrerd callback", done => {
            const cashier   = new Cashier(750000.00),
                  casino    = new Casino('Venetian').addHandlers(cashier),
                  wireMoney = new WireMoney(250000);
            Promise.resolve(casino.aspect(() => Promise.resolve(false))
                .defer(wireMoney)).then(handled => {
                throw new Error("Should not get here");
            }, error => {
                expect(error).to.be.instanceOf(RejectedError);
                done();
            });
        });

        it("should ignore async invocation", done => {
            const level2 = CallbackHandler(new Level2Security);
            Security(level2.aspect(() => {
                return Promise.resolve(false);
            })).scan().then(scanned => {
                throw new Error("Should not get here");
            }, error => {
                expect(error).to.be.instanceOf(RejectedError);
                done();
            });
        });

        it("should handle deferred callback with side-effect", done => {
            const cashier   = new Cashier(750000.00),
                  casino    = new Casino('Venetian').addHandlers(cashier),
                  wireMoney = new WireMoney(250000);
            Promise.resolve(casino.aspect(True, wire =>  done())
                .defer(wireMoney)).then(handled => {
                expect(handled).to.be.true;
                expect(wireMoney.received).to.equal(250000);
            });
        });

        it("should invoke async with side-effect", done => {
            const level2 = CallbackHandler(new Level2Security);
            Security(level2.aspect(True, () => done())).scan().then(scanned => {
                expect(scanned).to.be.true;
            });
        });

        it("should fail on exception in before", () => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino('Belagio').addHandlers(cashier),
                  countMoney = new CountMoney;
            expect(() => {
                expect(casino.aspect(() => { throw new Error; })
                       .handle(countMoney)).to.be.false;
            }).to.throw(Error);
        });

        it("should fail callback on rejection in before", done => {
            const cashier    = new Cashier(1000000.00),
                  casino     = new Casino('Belagio').addHandlers(cashier),
                  countMoney = new CountMoney();
            casino.aspect(() => {
                setTimeout(done, 2);
                return Promise.reject(new Error("Something bad"));
            }).defer(countMoney).catch(error => {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal("Something bad");
            });
        });

        it("should fail async invoke on rejection in before", done => {
            const level2 = CallbackHandler(new Level2Security);
            Security(level2.aspect(() => {
                setTimeout(done, 2);
                return Promise.reject(new Error("Something bad"));
            })).scan().catch(error => {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal("Something bad");
            });
        });
    });
    
    describe("#next", () => {
        it("should cascade handlers using short syntax", () => {
            const guest    = new Guest(17),
                  baccarat = new Activity('Baccarat'),
                  level1   = new Level1Security(),
                  level2   = new Level2Security(),
                  security = CallbackHandler(level1).next(level2);
            expect(Security(security).admit(guest)).to.be.false;
            Security(security).trackActivity(baccarat);
        });

        it("should compose handlers using short syntax", () => {
            const baccarat = new Activity('Baccarat'),
                  level1   = new Level1Security(),
                  level2   = new Level2Security(),
                  compose  = CallbackHandler(level1).next(level2, baccarat),
            countMoney = new CountMoney();
            expect(compose.handle(countMoney)).to.be.true;
        });
    });

    describe("#when", () => {
        it("should restrict handlers using short syntax", () => {
            const blackjack = new CardTable("BlackJack", 1, 5),
                  cardGames = (new (CallbackHandler.extend({
                      @handle(True)
                      close(cardTable) {
                          cardTable.closed = true;
                      }
                  }))).when(CardTable);
            expect(cardGames.handle(blackjack)).to.be.true;
            expect(blackjack.closed).to.be.true;
            expect(cardGames.handle(new Cashier())).to.be.false;
        });

        it("should restrict handlers invariantly using short syntax", () => {
            const Blackjack  = CardTable.extend({
                      constructor() {
                          this.base("BlackJack", 1, 5);
                     }
                  }),
                  blackjack  = new Blackjack(),
                  cardGames  = (new (CallbackHandler.extend({
                      @handle(True)
                      close(cardTable) {
                          cardTable.closed = true;
                      }
                  }))).when($eq(CardTable));
            expect(cardGames.handle(blackjack)).to.be.false;
            expect(blackjack.closed).to.be.undefined;
            expect(cardGames.handle(new Cashier())).to.be.false;
        });

        it("should restrict providers using short syntax", () => {
            const blackjack  = new CardTable("BlackJack", 1, 5),
                  cardGames  = (new (CallbackHandler.extend({
                      $provide:[
                          True, () => blackjack
                          ]
                  }))).when(CardTable);
            expect(cardGames.resolve(CardTable)).to.equal(blackjack);
            expect(cardGames.resolve(Cashier)).to.be.undefined;
        });

        it("should restrict providers invariantly using short syntax", () => {
            const blackjack  = new CardTable("BlackJack", 1, 5),
                  cardGames  = (new (CallbackHandler.extend({
                      $provide:[
                          True, () => blackjack
                      ]
                  }))).when($eq(Activity));
            expect(cardGames.resolve(Activity)).to.equal(blackjack);
            expect(cardGames.resolve(CardTable)).to.be.undefined;
            expect(cardGames.resolve(Cashier)).to.be.undefined;
        });
    });
    
    describe("#implementing", () => {
        const Calculator = Protocol.extend({
              add(op1, op2) {},
              divide(dividend, divisor) {},
              clear() {}
        });
        
        it("should call function", () => {
            const add = CallbackHandler.implementing("add", (op1, op2) =>  op1 + op2);
            expect(Calculator(add).add(5, 10)).to.equal(15);
        });

        it("should propgate exception in function", () => {
            const divide = CallbackHandler.implementing("divide", (dividend, divisor) => {
                if (divisor === 0)
                    throw new Error("Division by zero");
                return dividend / divisor;
            });
            expect(() => {
                Calculator(divide).divide(10,0);
            }).to.throw(Error, /Division by zero/);
        });

        it("should bind function", () => {
            const context = new Object(),
                  clear   = CallbackHandler.implementing("clear", (() => {
                  return context;
            }).bind(context));
            expect(Calculator(clear).clear()).to.equal(context);
        });

        it("should require non-empty method name", () => {
            expect(() => {
                CallbackHandler.implementing(null, () => {});
            }).to.throw(Error, /No methodName specified/);

            expect(() => {
                 CallbackHandler.implementing(void 0, () => {});
            }).to.throw(Error, /No methodName specified/);

            expect(() => {
                CallbackHandler.implementing(10, () => {});
            }).to.throw(Error, /No methodName specified/);

            expect(() => {
                CallbackHandler.implementing("", () => {});
            }).to.throw(Error, /No methodName specified/);

            expect(() => {
                CallbackHandler.implementing("   ", () => {});
            }).to.throw(Error, /No methodName specified/);
        });
    });
});

describe("CascadeCallbackHandler", () => {
    describe("#handle", () => {
        it("should cascade handlers", () => {
            const guest    = new Guest(17),
                  baccarat = new Activity('Baccarat'),
                  level1   = new Level1Security(),
                  level2   = new Level2Security(),
                  security = new CascadeCallbackHandler(level1, level2);
            expect(Security(security).admit(guest)).to.be.false;
            Security(security).trackActivity(baccarat);
        });
    });
});

describe("InvocationCallbackHandler", () => {
    describe("#handle", () => {
        it("should handle invocations", () => {
            const guest1 = new Guest(17),
                  guest2 = new Guest(21),
                  level1 = CallbackHandler(new Level1Security());
            expect(Security(level1).admit(guest1)).to.be.false;
            expect(Security(level1).admit(guest2)).to.be.true;
        });
        
        it("should handle async invocations", done => {
            const level2 = CallbackHandler(new Level2Security());
            Security(level2).scan().then(() => {
                done();
            });
        });

        it("should ignore explicitly unhandled invocations", () => {
            const texasHoldEm = new CardTable("Texas Hold'em", 2, 7),
                  casino      = new Casino('Caesars Palace')
                .addHandlers(texasHoldEm);
            expect(() => Game(casino).open(5)).to.not.throw(Error);
            expect(() => Game(casino).open(9)).to.throw(Error, /has no method 'open'/);
        });

        it("should fail missing methods", () => {
            const letItRide = new Activity('Let It Ride'),
                  level1    = new Level1Security(),
                  casino    = new Casino('Treasure Island')
                  .addHandlers(level1, letItRide);

            expect(() => {
                Security(casino).trackActivity(letItRide)
            }).to.throw(Error, /has no method 'trackActivity'/);
        });

        it("should ignore missing methods", () => {
            const letItRide = new Activity('Let It Ride'),
                  level1    = new Level1Security(),
                  casino    = new Casino('Treasure Island')
                  .addHandlers(level1, letItRide);
            expect(Security(casino.$bestEffort()).trackActivity(letItRide)).to.be.undefined;
        });

        it("should require protocol conformance", () => {
            const gate  = new (CallbackHandler.extend(Security, {
                      admit(guest) { return true; }
                  }));
            expect(Security(gate.$strict()).admit(new Guest('Me'))).to.be.true;
        });

        it("should reject if no protocol conformance", () => {
            const gate  = new (CallbackHandler.extend({
                      admit(guest) { return true; }
                  }));
            expect(() => {
                Security(gate.$strict()).admit(new Guest('Me'))
            }).to.throw(Error, /has no method 'admit'/);
        });

        it("should broadcast invocations", () => {
            const letItRide = new Activity('Let It Ride'),
                  level1    = new Level1Security(),
                  level2    = new Level2Security(),
                  casino    = new Casino('Treasure Island')
                  .addHandlers(level1, level2, letItRide);
            Security(casino.$broadcast()).trackActivity(letItRide);
        });

        it("should notify invocations", () => {
            const letItRide = new Activity('Let It Ride'),
                  level1    = new Level1Security(),
                  casino    = new Casino('Treasure Island')
                  .addHandlers(level1, letItRide);
            Security(casino.$notify()).trackActivity(letItRide);
        });

        it("should notify invocations", () => {
            const letItRide = new Activity('Let It Ride'),
                  level1    = new Level1Security(),
                  casino    = new Casino('Treasure Island')
                  .addHandlers(level1, letItRide);
            Security(casino.$notify()).trackActivity(letItRide);
        });

        it("should resolve target for invocation", () => {
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  }),
                  handler = new CallbackHandler(new Poker()),
                  id      = Game(handler.$resolve()).open(5);
            expect(id).to.equal("poker5");
        });

        it("should resolve target for invocation using promise", done => {
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  }),
                  handler = new (CallbackHandler.extend({
                      $provide: [
                          Game, () => Promise.delay(10).then(() => new Poker())
                      ]
                  }));
            Game(handler.$resolve()).open(5).then(id => {
                expect(id).to.equal("poker5");
                done();
            });
        });

        it("should resolve target for invocation implicitly", () => {
            const Pumping = Resolving.extend({
                      pump() {}
                  }),
                  Pump = Base.extend(Pumping, {
                      pump() { return 5; }
                  }),
                  handler = new CallbackHandler();
            $provide(handler, new Pump());
            expect(Pumping(handler).pump()).to.equal(5);
        });
        
        it("should fail invocation if unable to resolve", () => {
            const handler = new CallbackHandler();
            expect(() => {
                Game(handler.$resolve()).open(4);
            }).to.throw(TypeError, /has no method 'open'/);
        });

        it("should fail invocation if method not found", () => {
            const Poker   = Base.extend(Game),
                  handler = new CallbackHandler(new Poker());
            expect(() => {
                Game(handler.$resolve()).open(4);
            }).to.throw(TypeError, /has no method 'open'/);
        });

        it("should fail invocation promise if method not found", done => {
            const Poker   = Base.extend(Game),
                  handler = new (CallbackHandler.extend({
                      $provide: [
                          Game, () => Promise.delay(10).then(() => new Poker())
                      ]
                  }));
            Game(handler.$resolve()).open(5).catch(error => {
                expect(error).to.be.instanceOf(TypeError);
                expect(error.message).to.match(/has no method 'open'/)
                done();
            });            
        });

        it("should ignore invocation if unable to resolve", () => {
            const handler = new CallbackHandler(),
                  id      = Game(handler.$resolve().$bestEffort()).open(4);
            expect(id).to.be.undefined;
        });

        it("should ignore invocation if unable to resolve promise", done => {
            const handler = new (CallbackHandler.extend({
                      $provide: [
                          Game, () => {
                              return Promise.delay(10).then(() => $NOT_HANDLED);
                          }]
              }));
            Game(handler.$resolve().$bestEffort()).open(5).then(id => {
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
                  handler = new CascadeCallbackHandler(new Poker(), new Slots()),
                id      = Game(handler.$resolve().$broadcast()).open(5);
            expect(id).to.equal("poker5");
            expect(count).to.equal(2);
        });

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
                  handler = new CascadeCallbackHandler(
                      new (CallbackHandler.extend({
                          $provide: [
                              Game, () => Promise.delay(10).then(() => new Poker())
                          ]
                      })),
                      new (CallbackHandler.extend({
                          $provide: [
                              Game, () => Promise.delay(5).then(() => new Slots())
                          ]
                      }))
                );
            Game(handler.$resolve().$broadcast()).open(5).then(id => {
                expect(id).to.equal("poker5");
                expect(count).to.equal(2);                
                done();
            });
        });
        
        it("should fail invocation if unable to resolve all", () => {
            const handler = new CallbackHandler();
            expect(() => {
                Game(handler.$resolve().$broadcast()).open(4);
            }).to.throw(Error, /has no method 'open'/);
        });

        it("should apply filters to resolved invocations", () => {
            const Poker = Base.extend(Game, {
                      open(numPlayers) {
                          return "poker" + numPlayers;
                      }
                  }),
                  handler = new CallbackHandler(new Poker());
            expect(Game(handler.$resolve().filter(
                (cb, cm, proceed) => proceed())).open(5))
                .to.equal("poker5");
            expect(() => {
                Game(handler.$resolve().filter(False)).open(5);
            }).to.throw(Error, /has no method 'open'/);
        });
    })
});

describe("CallbackHandler", () => {
    const Emailing = StrictProtocol.extend({
             send(msg) {},
             sendConfirm(msg) {},        
             fail(msg) {},
             failConfirm(msg) {}        
             }),
          EmailHandler = CallbackHandler.extend(Emailing, {
              send(msg) {
                  const batch = this.getBatch();
                  return batch ? batch.send(msg) : msg; 
              },
              sendConfirm(msg) {
                  const batch = this.getBatch();
                  return batch ? batch.sendConfirm(msg)
                       : Promise.resolve(msg);
              },            
              fail(msg) {
                  throw new Error("Can't send message");
              },
              failConfirm(msg) {
                  const batch = this.getBatch();
                  return batch ? batch.failConfirm(msg)
                       : Promise.reject(Error("Can't send message"));
              },            
              getBatch() {
                  const batcher = $composer.getBatcher(Emailing);
                  if (batcher) {
                      const batch = new EmailBatch();
                      batcher.addHandlers(batch);
                      return batch;
                  }
              }
          });
        const EmailBatch = Base.extend(Emailing, Batching, {
            constructor() {
                let _msgs     = [],
                    _resolves = [],
                    _promises = [];
                this.extend({
                    send(msg) {
                        _msgs.push(msg + " batch");
                    },
                    sendConfirm(msg) {
                        _msgs.push(msg);
                        const promise =  new Promise(resolve =>
                            _resolves.push(() => { resolve(msg + " batch"); })
                        );
                        _promises.push(promise);
                        return promise;
                    },
                    failConfirm(msg) {
                        const promise = new Promise((resolve, reject) =>
                            _resolves.push(() => { reject(Error("Can't send message")); })
                        );
                        _promises.push(promise);
                        return promise;
                    },
                    complete(composer) {
                        for (let i = 0; i < _resolves.length; ++i) {
                            _resolves[i]();
                        }
                        const results = Emailing(composer).send(_msgs);
                        return _promises.length > 0
                             ? Promise.all(_promises).then(() => { return results; })
                             : results;
                    }
                });
            }
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

        it("should pass promise returns through", done => {
            const handler = new EmailHandler,
                  msg     = Promise.resolve("Hello");
            expect(Emailing(handler).send(msg)).to.equal(msg);
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
            const bank = (new (CallbackHandler.extend({
                      @handle(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }
                  }))),
                  casino    = new Casino('Venetian').addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50).defer(wireMoney)).catch(err => {
                expect(err).to.be.instanceOf(TimeoutError);
                done();
            });
        });

        it("should ignore time out if promise resolved", done => {
            const bank = (new (CallbackHandler.extend({
                      @handle(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(50).then(() => wireMoney);
                      }
                  }))),
                  casino    = new Casino('Venetian').addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(100).defer(wireMoney)).then(handled => {
                expect(handled).to.be.true;
                expect(wireMoney.received).to.equal(50000);
                done();
            });
        });
        
        it("should reject promise with error instance", done => {
            const bank = (new (CallbackHandler.extend({
                      @handle(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }                
                  }))),
                  casino    = new Casino('Venetian').addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50, new Error("Oh No!"))
                            .defer(wireMoney)).catch(err => {
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
            const bank = (new (CallbackHandler.extend({
                      @handle(WireMoney)
                      wireMoney(wireMoney) {
                          wireMoney.received = 50000;
                          return Promise.delay(100).then(() => wireMoney);
                      }                
                  }))),
                  casino    = new Casino('Venetian').addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50, BankError)
                            .defer(wireMoney)).catch(err => {
                expect(err).to.be.instanceOf(BankError);
                expect(err.callback.callback).to.equal(wireMoney);
                done();
            });
        });

        it("should propogate errors", done => {
            const bank = (new (CallbackHandler.extend({
                      @handle(WireMoney)
                      wireMoney(wireMoney) {
                          return Promise.reject(new Error("No money"))                    
                      }                
                  }))),
                  casino    = new Casino('Venetian').addHandlers(bank),
                  wireMoney = new WireMoney(150000);
            Promise.resolve(casino.$timeout(50, new Error("Oh No!"))
                            .defer(wireMoney)).catch(err => {
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

