import { Cached } from "../../src/api/cache/cached";
import { CachedHandler } from "../../src/api/cache/cached-handler";
import { typeId } from "../../src/map/type-mapping";
import { HandlerBuilder } from "../../src/handler-builder";
import "../../src/api/handler-api";

import { 
    StockQuote, GetStockQuote, StockQuoteHandler
} from "./stock-quote-handler";

import { expect } from "chai";

describe("Cached", () => {
    let handler;
    beforeEach(async () => {
        handler = new HandlerBuilder()
            .addTypes(from => from.types(StockQuoteHandler))
            .build();
        await handler.send(new GetStockQuote("AAPL").invalidate());
    });

    it("should make initial request", async () => {
        const getQuote = new GetStockQuote("AAPL"),
              quote    = await handler.send(getQuote.cached());
        expect(quote).to.be.instanceOf(StockQuote);
        expect(quote.symbol).to.equal("AAPL");
        expect(getQuote.called).to.equal(1);
    });

    it("should cache initial response", async () => {
        const getQuote = new GetStockQuote("AAPL"),
              quote1   = await handler.send(getQuote.cached()),
              quote2   = await handler.send(getQuote.cached()),
              quote3   = await handler.send(getQuote);
        expect(quote1).to.be.instanceOf(StockQuote);
        expect(quote2).to.equal(quote1);
        expect(quote3).to.not.equal(quote1);
        expect(getQuote.called).to.equal(2);
    });   

    it("should refresh response", async () => {
        const getQuote = new GetStockQuote("AAPL"),
              quote1   = await handler.send(getQuote.cached()),
              quote2   = await handler.send(getQuote.cached()),
              quote3   = await handler.send(getQuote.refresh());
        expect(quote1).to.be.instanceOf(StockQuote);
        expect(quote2).to.equal(quote1);
        expect(quote3).to.not.equal(quote1);
        expect(getQuote.called).to.equal(2);
    });

    it("should refresh stale response", async () => {
        const getQuote = new GetStockQuote("AAPL"),
              quote1   = await handler.send(getQuote.cached());
        await Promise.delay(200);
        const quote2   = await handler.send(getQuote.cached(100))
        expect(quote2).to.not.equal(quote1);
    });

    it("should invalidate response", async () => {
        const getQuote = new GetStockQuote("AAPL"),
              quote1   = await handler.send(getQuote.cached()),
              quote2   = await handler.send(getQuote.cached()),
              quote3   = await handler.send(getQuote.invalidate()),
              quote4   = await handler.send(getQuote.cached());
        expect(quote2).to.equal(quote1);
        expect(quote3).to.equal(quote1);
        expect(quote4).to.be.instanceOf(StockQuote);
        expect(quote4).to.not.equal(quote1);
    });

    it("should not cache exceptions", async () => {
        const getQuote = new GetStockQuote("EX");

        try {
            await handler.send(getQuote.cached());
            expect.fail("Expected exception!");
        } catch (ex) {
            expect(ex.message).to.equal("Stock Exchange is down");
        }

        try {
            await handler.send(getQuote.cached());
            expect.fail("Expected exception!");
        } catch (ex) {
            expect(ex.message).to.equal("Stock Exchange is down");
        }

        expect(getQuote.called).to.equal(2);
    });

    it("should generate type identifier", () => {
        const getQuote = new GetStockQuote("APPL").cached(),
              id       = typeId.get(getQuote);
        expect(id).to.equal("Miruken.Api.Cache.Cached`1[[StockQuote]], Miruken");
    });  
});
