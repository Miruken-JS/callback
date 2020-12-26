import { assignID } from "miruken-core";
import { handles } from "../../src/callback-policy";
import { HandlerBuilder } from "../../src/handler-builder";
import { Concurrent } from "../../src/api/schedule/scheduled";
import { PassThroughRouter } from "../../src/api/route/pass-through-router";
import { Routed } from "../../src/api/route/routed";
import { routes } from "../../src/api/route/routes";
import { typeId } from "../../src/api/type-id";
import { NotHandledError } from "../../src/errors";
import "../../src/handler-batch";

import { 
    StockQuote, GetStockQuote, SellStock,
    StockQuoteHandler
} from "./stock-quote-handler";

import { expect } from "chai";

describe("routes", () => {
    let handler, recycleBin;
    beforeEach(async () => {
        recycleBin = [];
        handler = new HandlerBuilder()
            .addTypes(from => from.types(StockQuoteHandler, TrashRouter))
            .build();
    });

    class TrashRouter {
        @routes("trash")
        @handles(Routed)
        route(routed) {
            const { message } = routed;
            console.log(`Throw ${message.constructor.name} ${JSON.stringify(message)} in the trash`);
            recycleBin.push(message);
        }
    }

    it("should pass through request", async () => {
        const quote = await handler.$chain(new PassThroughRouter()).send(
            new GetStockQuote("APPL").routeTo(PassThroughRouter.scheme));
        expect(quote.symbol).to.equal("APPL");
    });

    it("should route requests", async () => {
        const getQuote1 = new GetStockQuote("GOOGL"),
              getQuote2 = new GetStockQuote("APPL"),
              quote1    = await handler.send(getQuote1.routeTo("trash")),
              quote2    = await handler.send(getQuote2.routeTo("trash"));
        expect(quote1).to.be.undefined;
        expect(quote2).to.be.undefined;
        expect(recycleBin).to.include(getQuote1, getQuote2);
    });

    it("should batch route requests", () => {
        const getQuote1 = new GetStockQuote("GOOGL"),
              getQuote2 = new GetStockQuote("APPL");
        handler.$batch(batch => {
            batch.send(getQuote1.routeTo("trash"));
            batch.send(getQuote2.routeTo("trash"));
        });
        const trash = recycleBin[0];
        expect(trash).to.be.instanceOf(Concurrent);
        expect(trash.requests).to.include(getQuote1, getQuote2);
    });

    it("should fail if missing route", async () => {
        const getQuote = new GetStockQuote("GOOGL").routeTo("nowhere");
        try {
            await handler.send(getQuote);
                expect.fail("Should have failed");  
        } catch (error) {
            expect(error).to.be.instanceOf(NotHandledError);
            expect(error.callback).to.equal(getQuote);
        }
    });

    it("should generate type identifier with response", () => {
        const getQuote = new GetStockQuote("APPL").routeTo("http://server/api"),
              id       = typeId.getId(getQuote);
        expect(id).to.equal("Miruken.Api.Route.Routed`1[[StockQuote]], Miruken");
    });

    it("should generate cache key with response", () => {
        const getQuote = new GetStockQuote("APPL").routeTo("http://server/api"),
              cacheKey = getQuote.getCacheKey();
        expect(cacheKey).to.equal(`{"message":"${assignID(GetStockQuote)}#{\\"symbol\\":\\"APPL\\"}","route":"http://server/api"}`);
    }); 

    it("should generate type identifier without response", () => {
        const sellStock = new SellStock("APPL", 5).routeTo("http://server/api"),
              id        = typeId.getId(sellStock);
        expect(id).to.equal("Miruken.Api.Route.Routed, Miruken");
    }); 

    it("should not generate cache key without response", () => {
        const sellStock = new SellStock("APPL", 5).routeTo("http://server/api"),
              cacheKey  = sellStock.getCacheKey();
        expect(cacheKey).to.be.undefined;
    });       
});