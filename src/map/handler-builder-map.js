import { HandlerBuilder } from "../../src/handler-builder";
import { JsonMapping } from "./json-mapping";
import { TypeMapping } from "./type-mapping";

HandlerBuilder.implement({
    withJsonMapping() {
        this.addHandlers(new JsonMapping(), new TypeMapping());
        return this;
    }
});