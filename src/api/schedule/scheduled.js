import { typeId } from "../../map/type-mapping";
import { Request } from "../request";
import { response } from "../response";
import { MessageWrapper } from "../message";

export class ScheduledResult {
    constructor(responses) {
        this.responses = responses || [];
    }

    responses;
}

@response(ScheduledResult)
@typeId("Miruken.Api.Schedule.Scheduled, Miruken")
export class Scheduled extends Request {
    constructor(requests) {
        super();
        if (new.target === Scheduled) {
            throw new TypeError("Scheduled cannot be instantiated.");
        }
        this.requests = requests || [];
    }

    requests;
}

export class Concurrent extends Scheduled {}
export class Sequential extends Scheduled {}
export class Publish extends MessageWrapper {}
