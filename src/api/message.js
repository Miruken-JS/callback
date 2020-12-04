import {
    Base, $isNothing, assignID 
} from "miruken-core";

export class Message extends Base {}

export class MessageWrapper extends Base {
    constructor(message) {
        if (new.target === MessageWrapper) {
            throw new TypeError("MessageWrapper cannot be instantiated.");
        }
        super();
        this.message = message;
    }

    message;

    getCacheKey() { 
        const message  = this.message,
              cacheKey = message?.getCacheKey?.();
        if (!$isNothing(cacheKey)) {
            return `${assignID(message.constructor)}|${cacheKey}`;
        }
    }
}
