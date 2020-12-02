import { 
    Enum, $isNothing, createKey
} from "miruken-core";

import { Request, RequestWrapper } from "../request";
import { typeId } from "../../map/type-mapping";
import { response } from "../response";

const _ = createKey();

export const CacheAction = Enum({
    Refresh:    0,
    Invalidate: 1
});

export class Cached extends RequestWrapper {
    constructor(request) {
        super(request);
    }

    get action() { return _(this).action; }
    set action(value) { _(this).action = value; }

    get timeToLive() { return _(this).timeToLive; }
    set timeToLive(value) { _(this).timeToLive = value; }

    @typeId
    get typeId() {
        const responseType = response.get(this.request);
        if ($isNothing(responseType)) return;
        const responseTypeId = typeId.get(responseType);
        if ($isNothing(responseTypeId)) return;
        return `Miruken.Api.Cache.Cached\`1[[${responseTypeId}]], Miruken`;
    }
}

Request.implement({
    cached(timeToLive) {
        const cached = new Cached(this);
        cached.timeToLive = timeToLive;
        return cached;
    },
    invalidate() {
        const cached = new Cached(this);
        cached.action = CacheAction.Invalidate;
        return cached;
    },
    refresh() {
        const cached = new Cached(this);
        cached.action = CacheAction.Refresh;
        return cached;
    }  
})