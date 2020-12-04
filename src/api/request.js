import {
    Base, $isNothing, assignID 
} from "miruken-core";

export class Request extends Base {}

export class RequestWrapper extends Request {
    constructor(request) {
        if (new.target === RequestWrapper) {
            throw new TypeError("RequestWrapper cannot be instantiated.");
        }
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

