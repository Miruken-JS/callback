import { Enum, createKey } from "miruken-core";
import { Request, RequestWrapper } from "../request";

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