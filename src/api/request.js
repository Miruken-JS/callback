import {
    Base, $isNothing, assignID,
    createKeyChain 
} from "miruken-core";

const _ = createKeyChain();

export class Request extends Base {}

export class RequestWrapper extends Request {
    constructor(request) {
        super();
        this.request = request;
    }

    get request() { return _(this).request; }
    set request(value) { _(this).request = value; }

    getCacheKey() { 
        const request  = this.request,
              cacheKey = request?.getCacheKey?.();
        if (!$isNothing(cacheKey)) {
            return `${assignID(request.constructor)}|${cacheKey}`;
        }
    }
}