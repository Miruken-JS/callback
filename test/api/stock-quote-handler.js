import { Base } from "miruken-core";
import { Handler } from "../../src/handler";
import { handles } from "../../src/callback-policy";
import { Request } from "../../src/api/request";
import { typeId } from "../../src/map/type-mapping";
import { response } from "../../src/api/response";

@typeId("StockQuote")
export class StockQuote extends Base {
    symbol;
    value;
}

@response(StockQuote)
@typeId("GetStockQuote")
export class GetStockQuote extends Request {
    constructor(symbol) {
        super();
        this.symbol = symbol;
    }

    symbol;
    called = 0;

    getCacheKey() { return this.symbol; }
}

@typeId("SellStock")
export class SellStock {
    constructor(symbol, numShares) {
        this.symbol    = symbol;
        this.numShares = numShares;
    }

    symbol;
    numShares;
}

export class StockQuoteHandler extends Handler {
    @handles(GetStockQuote)
    getQuote(getQuote) {
        ++getQuote.called;
        
        if (getQuote.symbol == "EX")
            throw new Error("Stock Exchange is down");

        return Promise.resolve(new StockQuote().extend({
            symbol: getQuote.symbol,
            value:  Math.random() * 10
        }));
    }

    @handles(SellStock)
    sellStock(sellStock) {
        if (sellStock.Symbol == "EX")
            throw new Error("Stock Exchange is down");
    }
}
