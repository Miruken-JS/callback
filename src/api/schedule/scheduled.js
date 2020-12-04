import { typeId } from "../../map/type-mapping";
import { response } from "../response";

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
        this.requests = requests || [];
    }

    requests;
}

export class Concurrent extends Scheduled {}
export class Sequential extends Scheduled {}

export class Publish {
    constructor(message) {
        this.message = message;
    }

    message;
}
