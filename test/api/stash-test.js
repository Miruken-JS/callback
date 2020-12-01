import { 
    Enum, conformsTo, type, createKey
} from "miruken-core";

import { Handler } from "../../src/handler";
import { InferenceHandler } from "../../src/inference-handler";
import { handles, provides } from "../../src/callback-policy";
import { Filtering } from "../../src/filter/filtering";
import { filter } from "../../src/filter/filter";
import { Stash } from "../../src/api/stash";
import { NotHandledError } from "../../src/errors";
import "../../src/api/handler-stash";

import { expect } from "chai";

const _ = createKey();

const OrderStatus = Enum({
    Created:   1,
    Cancelled: 2
});

class Order {
    id;
    status = OrderStatus.Created;
}

class CancelOrder {
    constructor(orderId) {
        _(this).orderId = orderId;
    }

    get orderId() { return _(this).orderId; }
}

@provides()
@conformsTo(Filtering)
class CancelOrderFilter {
    next(callback, { next, composer }) {
        if (callback instanceof CancelOrder) {
            const order = new Order();
            order.id = callback.orderId;
            composer.stashPut(order);
        }
        return next();
    }
}

@provides()
class OrderHandler extends Handler {
    @handles(CancelOrder)
    @filter(CancelOrderFilter)
    cancel(cancel, @type(Order) order, { composer }) {
        order.status = OrderStatus.Cancelled;
        return order;
    }
}

describe("Stash", () => {
    it("should add stash", () => {
        const order = new Order(),
              stash = new Stash();
        stash.stashPut(order);
        expect(stash.stashGet(Order)).to.equal(order);
    });

    it("should add stash explicitly", () => {
        const order = new Order(),
              stash = new Stash();
        stash.stashPut(order, "order");
        expect(stash.stashGet("order")).to.equal(order);
        expect(stash.stashTryGet(Order)).to.be.undefined;
    });

    it("should get or add stash", () => {
        const order = new Order(),
              stash = new Stash();
        expect(stash.stashGetOrPut(Order, order)).to.equal(order);
        expect(stash.stashGet(Order)).to.equal(order);
    });

    it("should cascade stash", () => {
        const order  = new Order(),
              stash  = new Stash(),
              stash2 = new Stash().$chain(stash);
        stash.stashPut(order);
        expect(stash2.stashGet(Order)).to.equal(order);
    });

    it("should hide stash", () => {
        const order  = new Order(),
              stash  = new Stash(),
              stash2 = new Stash().$chain(stash);
        stash.stashPut(order);
        expect(stash2.stashGet(Order)).to.equal(order);
        stash2.stashPut(null, Order);
        expect(stash2.stashGet(Order)).to.be.null;
    });

    it("should access stash", () => {
        const handler = new Stash().$chain(
            new InferenceHandler(OrderHandler, CancelOrderFilter));
        const order = handler.command(new CancelOrder(1));
        expect(order).to.not.be.null;
        expect(order.id).to.equal(1);
        expect(order.status).to.equal(OrderStatus.Cancelled);
    });

    it("should fail if Stash not found", () => {
        expect(() => {
           new Stash().stashGet(Order);
        }).to.throw(NotHandledError);
    });

    it("should not fail if rooted Stash not found", () => {
        expect(new Stash(true).stashGet(Order)).to.be.undefined;
    });

    it("should fail if Stash not available", () => {
        expect(() => {
           new Handler().stashPut(new Order());
        }).to.throw(NotHandledError);
    });
});