import { Enum, $isNothing } from "miruken-core";
import { Request, RequestWrapper } from "../request";
import { response } from "../response";
import { typeId } from "../type-id";

export const CacheAction = Enum({
    Refresh:    0,
    Invalidate: 1
});

export class Cached extends RequestWrapper {
    constructor(request) {
        super(request);
    }

    action;
    timeToLive;

    @typeId
    get typeId() {
        const responseType = response.get(this.request);
        if ($isNothing(responseType)) return;
        const responseTypeId = typeId.getId(responseType);
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