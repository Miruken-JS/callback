import { Base, createKey } from "miruken-core";
import { Handler } from "../../src/handler";
import { handles } from "../../src/callback-policy";
import { Request } from "../../src/api/request";

const _ = createKey();

export class StockQuote extends Base {
    get symbol() { return _(this).symbol; }
    set symbol(value) { _(this).symbol = value; }

    get value() { return _(this).value; }
    set value(value) { _(this).value = value; }
}

export class GetStockQuote extends Request {
    constructor(symbol) {
        super();
        this.symbol = symbol;
        _(this).called = 0;
    }

    get symbol() { return _(this).symbol; }
    set symbol(value) { _(this).symbol = value; }

    getCacheKey() { return this.symbol; }

    get called() { return _(this).called; }
    incrementCalled() { ++_(this).called; }
}

export class StockQuoteHandler extends Handler {
    @handles(GetStockQuote)
    getQuote(getQuote) {
        getQuote.incrementCalled();
        
        if (getQuote.symbol == "EX")
            throw new Error("Stock Exchange is down");

        return Promise.resolve(new StockQuote().extend({
            symbol: getQuote.symbol,
            value:  Math.random() * 10
        }));
    }
}
