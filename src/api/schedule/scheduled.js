import { typeId } from "../../map/type-mapping";
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
export class Scheduled {
    constructor(requests) {
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
