import { 
    $isNothing, Try, $isPromise
} from "miruken-core";

import { Handler } from "../../handler";
import { handles, provides } from "../../callback-policy";
import { singleton } from "../../singleton-lifestyle";

import { 
    Sequential, Concurrent, ScheduledResult,
    Publish
} from "./scheduled";

@provides() @singleton()
export class Scheduler extends Handler {
    @handles(Concurrent)
    async concurrent(concurrent, { composer }) {
        const { requests } = concurrent;
        if ($isNothing(requests) || requests.length == 0) {
            return Promise.resolve(new ScheduledResult());
        }
        const responses = await Promise.all(
            requests.map(r => process.call(this, r, composer))
        );
        return new ScheduledResult(responses);
    }

    @handles(Sequential)
    async sequential(sequential, { composer }) {
        const { requests } = sequential;
        if ($isNothing(requests)) {
            return Promise.resolve(new ScheduledResult());
        }
        const responses = [];
        for (const request of requests) {
            const response = await process.call(this, request, composer);
            responses.push(response);
            if (response instanceof Try.Failure) break;
        }
        return new ScheduledResult(responses);    
    }

    @handles(Publish)
    publish(publish, { composer }) {
        return this.publish(publish.message);
    }
}

function process(request, composer) {
    try {
        const result = request instanceof Publish
                     ? composer.publish(request.message)
                     : composer.send(request);
        if ($isPromise(result)) {
            return result.then(res => Try.success(res))
                .catch(reason => Try.failure(reason));
        }
        return Promise.resolve(Try.success(result))
    } catch (error) {
        return Promise.resolve(Try.failure(error));
    }
}