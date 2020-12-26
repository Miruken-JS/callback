import { Try, design } from "miruken-core";
import { Request } from "../request";
import { response } from "../response";
import { MessageWrapper } from "../message";
import { typeId } from "../type-id";

export class ScheduledResult {
    constructor(responses) {
        this.responses = responses || [];
    }

    @design([Try])
    responses;
}

@response(ScheduledResult)
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

@typeId("Miruken.Api.Schedule.Concurrent, Miruken")
export class Concurrent extends Scheduled {}

@typeId("Miruken.Api.Schedule.Sequential, Miruken")
export class Sequential extends Scheduled {}

@typeId("Miruken.Api.Schedule.Publish, Miruken")
export class Publish extends MessageWrapper {}
