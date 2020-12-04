import { Concurrent } from "../../src/api/schedule/scheduled";
import { HandlerBuilder } from "../../src/handler-builder";
import { Publish } from "../../src/api/schedule/scheduled";
import "../../src/api/schedule/handler-scheduled";

import { 
    StockQuote, GetStockQuote, SellStock,
    StockQuoteHandler
} from "./stock-quote-handler";

import { expect } from "chai";

describe("Scheduled", () => {
    let handler;
    beforeEach(async () => {
        handler = new HandlerBuilder()
            .addTypes(from => from.types(StockQuoteHandler))
            .build();
    });

    describe("Concurrent", () => {
        it("should execute concurrently", async () => {
            const result = await handler.concurrent(
                new GetStockQuote("APPL"),
                new GetStockQuote("MSFT"),
                new GetStockQuote("GOOGL")
            );
            const responses = result.responses;
            expect(responses.length).to.equal(3);
            const symbols = responses.map(
                r => r.fold(x => x.message, x => x.symbol
            ));
            expect(symbols).to.eql(["APPL", "MSFT", "GOOGL"]);
        });

        it("should propagate multiple exceptions", async () => {
            const result = await handler.concurrent(
                new GetStockQuote("EX"),
                new GetStockQuote("APPL"),
                new GetStockQuote("EX")
            );
            const responses = result.responses;
            expect(responses.length).to.equal(3);
            const symbols = responses.map(
                r => r.fold(x => x.message, x => x.symbol
            ));
            expect(symbols).to.eql([
                "Stock Exchange is down",
                "APPL",
                "Stock Exchange is down"]);
        });

        it("should publish concurrently", async () => {
            const result = await handler.concurrent(
                new Publish(new SellStock("AAPL",  2)),
                new Publish(new SellStock("MSFT",  1)),
                new Publish(new SellStock("GOOGL", 2))
            );
            const responses = result.responses;
            expect(responses.length).to.equal(3);
        });
    });

    describe("Sequential", () => {
        it("should execute sequentially", async () => {
            const result = await handler.sequential(
                new GetStockQuote("APPL"),
                new GetStockQuote("MSFT"),
                new GetStockQuote("GOOGL")
            );
            const responses = result.responses;
            expect(responses.length).to.equal(3);
            const symbols = responses.map(
                r => r.fold(x => x.message, x => x.symbol
            ));
            expect(symbols).to.eql(["APPL", "MSFT", "GOOGL"]);
        });

        it("should stop at first exceptions", async () => {
            const result = await handler.sequential(
                new GetStockQuote("APPL"),
                new GetStockQuote("EX"),
                new GetStockQuote("GOOGL")
            );
            const responses = result.responses;
            expect(responses.length).to.equal(2);
            const symbols = responses.map(
                r => r.fold(x => x.message, x => x.symbol
            ));
            expect(symbols).to.eql([
                "APPL",
                "Stock Exchange is down"]);
        });

        it("should publish sequentially", async () => {
            const result = await handler.sequential(
                new Publish(new SellStock("AAPL",  2)),
                new Publish(new SellStock("MSFT",  1)),
                new Publish(new SellStock("GOOGL", 2))
            );
            const responses = result.responses;
            expect(responses.length).to.equal(3);
        });
    });    
});