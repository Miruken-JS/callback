import { $isNothing } from "miruken-core";
import { Request } from "../request";
import { Message, MessageWrapper } from "../message";
import { typeId } from "../../map/type-mapping";
import { response } from "../response";

export class Routed extends MessageWrapper {
    route;
    tag;

    @typeId
    get typeId() {
        const responseType = response.get(this.message);
        if ($isNothing(responseType)) {
            return `Miruken.Api.Route.Routed, Miruken`;
        }
        const responseTypeId = typeId.get(responseType);
        if ($isNothing(responseTypeId)) return;
        return `Miruken.Api.Route.Routed\`1[[${responseTypeId}]], Miruken`;
    }
}

export class BatchRouted {
    constructor(routed, rawCallback) {
        this.routed      = routed;
        this.rawCallback = rawCallback;
    }

    routed;
    rawCallback;
}

Request.implement({
    routeTo(route, tag) {
        const routed = new Routed(this);
        routed.route = route;
        routed.tag   = tag;
        return routed;
    }
});

Message.implement({
    routeTo(route, tag) {
        const routed = new Routed(this);
        routed.route = route;
        routed.tag   = tag;
        return routed;
    }
});
