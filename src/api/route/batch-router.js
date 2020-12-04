import { 
    $isNothing, conformsTo, createKey
} from "miruken-core";

import { handles, $unhandled } from "../../callback-policy";
import { Handler } from "../../handler";
import { Command } from "../../command";
import { Batching } from "../../batch";
import { Routed, BatchRouted } from "../route/routed";
import { Concurrent, Publish } from "../schedule/scheduled";
import { unmanaged } from "../../unmanaged";
import "../handler-api";

const _ = createKey();

@unmanaged
@conformsTo(Batching)
export class BatchRouter extends Handler {
    constructor() {
        super();
        _(this).groups = new Map();
    }

    @handles(BatchRouted)
    routeBatch(batched, { rawCallback }) {
        return route(batched.routed, 
            { rawCallback: batched.rawCallback || rawCallback });
    }

    @handles(Routed)
    route(routed, { rawCallback }) {
        if (!rawCallback instanceof Command) {
            return $unhandled;
        }
        const groups = _(this).groups,
              { route, message } = routed;         
        let group = groups.get(route);
        if ($isNothing(group)) {
            group = [];
            groups.set(route, group);
        }
        const pending = rawCallback.isMany ? new Publish(message) : message,
              request = new Pending(pending);
        group.push(request);
        return request.promise;
    }

    complete(composer) {
        const groups   = [..._(this).groups.entries()],
              complete = Promise.all(groups.map(([uri, requests]) => {
            const messages = requests.map(r => r.message);
            return composer.send(new Concurrent(messages).routeTo(uri)).then(result => {
                const responses = result.responses;
                // Cancel when available on Promise
                // for (let i = responses.length; i < requests.length; ++i) {
                //    requests[i].promise.cancel();
                //}
                return { uri, responses: responses
                    .map((response, i) => response.fold(
                        failure => {
                            requests[i].reject(failure);
                            return failure;
                        },
                        success => {
                            requests[i].resolve(success);
                            return success;
                        }))
                };
            }).catch(reason => {
                // Cancel requests when Promise.cancel
                //requests.forEach(r => r.Promise.cancel());
                return Promise.reject(reason);
            });
        }));
        _(this).groups.clear();
        return complete;
    }    
}

class Pending {
    constructor(message) {
        this.message = message;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject  = reject;
        });
    }

    message;
    promise;
    resolve;
    reject;
}