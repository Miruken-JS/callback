import { handles } from "../../src/callback-policy";
import { HandlerBuilder } from "../../src/handler-builder";
import { PassThroughRouter } from "../../src/api/route/pass-through-router";
import { Routed } from "../../src/api/route/routed";
import { routes } from "../../src/api/route/routes";
import { typeId } from "../../src/map/type-mapping";
import { NotHandledError } from "../../src/errors";

import { 
    StockQuote, GetStockQuote, SellStock,
    StockQuoteHandler
} from "./stock-quote-handler";

import { expect } from "chai";

class TrashRouter {
    @routes("trash")
    @handles(Routed)
    route(routed) {
        const { message } = routed;
        console.log(`Throw ${message.constructor.name} ${JSON.stringify(message)} in the trash`);
    }
}

describe("routes", () => {
    let handler;
    beforeEach(async () => {
        handler = new HandlerBuilder()
            .addTypes(from => from.types(StockQuoteHandler, TrashRouter))
            .build();
    });

    it("should pass through request", async () => {
        const quote = await handler.$chain(new PassThroughRouter()).send(
            new GetStockQuote("APPL").routeTo(PassThroughRouter.scheme));
        expect(quote.symbol).to.equal("APPL");
    });

    it("should route requests", async () => {
        const quote = await handler.send(
            new GetStockQuote("GOOGL").routeTo("trash"));
        expect(quote).to.be.undefined;
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
              id       = typeId.get(getQuote);
        expect(id).to.equal("Miruken.Api.Route.Routed`1[[StockQuote]], Miruken");
    });

    it("should generate cache key with response", () => {
        const getQuote = new GetStockQuote("APPL").routeTo("http://server/api"),
              cacheKey = getQuote.getCacheKey();
        expect(cacheKey).to.equal('{"message":"b2_11#{\\"symbol\\":\\"APPL\\"}","route":"http://server/api"}');
    }); 

    it("should generate type identifier without response", () => {
        const sellStock = new SellStock("APPL", 5).routeTo("http://server/api"),
              id        = typeId.get(sellStock);
        expect(id).to.equal("Miruken.Api.Route.Routed, Miruken");
    }); 

    it("should not generate cache key without response", () => {
        const sellStock = new SellStock("APPL", 5).routeTo("http://server/api"),
              cacheKey  = sellStock.getCacheKey();
        expect(cacheKey).to.be.undefined;
    });       
});