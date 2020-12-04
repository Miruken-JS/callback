import {
    Base, $isNothing, assignID 
} from "miruken-core";

export class Request extends Base {}

export class RequestWrapper extends Request {
    constructor(request) {
        super();
        this.request = request;
    }

    request;

    getCacheKey() { 
        const request  = this.request,
              cacheKey = request?.getCacheKey?.();
        if (!$isNothing(cacheKey)) {
            return `${assignID(request.constructor)}|${cacheKey}`;
        }
    }
}