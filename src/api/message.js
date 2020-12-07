import {
    Base, $isNothing, $classOf, assignID 
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
        const message    = this.message,
              messageKey = message?.getCacheKey?.();
        if (!$isNothing(messageKey)) {
            return JSON.stringify(this, (name, value) =>
                name === "message"
                ? `${assignID($classOf(message))}#${messageKey}`
                : value
            );
        }
    }
}
