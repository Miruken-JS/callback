import { 
    $isNothing, $isFunction, $isPromise,
    $classOf, assignID, createKey
} from "miruken-core";

import { Handler } from "../../handler";
import { handles, provides } from "../../callback-policy";
import { singleton } from "../../singleton-lifestyle";
import { Cached, CacheAction } from "./cached";

const ONE_DAY_MS = 86400000,
      _ = createKey();

@provides() @singleton()
export class CachedHandler extends Handler {
    constructor() {
        super();
        _(this).cache = new Map();
    }

    @handles(Cached)
    cached(cached, { composer }) {
        const { request, action } = cached; 
        if ($isNothing(request)) return;

        const cacheKey = createCacheKey(request);
        if ($isNothing(cacheKey)) {
            return composer.send(request);
        }

        const cache = _(this).cache,
              entry = cache?.get(cacheKey);

        if (action === CacheAction.Refresh || 
            action === CacheAction.Invalidate) {
            cache?.delete(cacheKey);
            if (action === CacheAction.Invalidate) {
                return entry?.response;
            }
        }

        if ($isNothing(entry) || action === CacheAction.Refresh) {
            return refreshResponse.call(this, cache, cacheKey, request, composer);
        }

        const timeToLive = cached.timeToLive || ONE_DAY_MS;
        if (Date.now() >= entry.lastUpdated + timeToLive) {
            return refreshResponse.call(this, cache, cacheKey, request, composer);
        }

        return entry.response;
    }
}

function refreshResponse(cache, cacheKey, request, composer) {
    const response = composer.send(request);
    if ($isNothing(response)) return;

    const entry = {
        response:    response,
        lastUpdated: Date.now()
    };

    if ($isPromise(response)) {
        response.then(
            result => entry.response = Promise.resolve(result),
            reason => {
                if (cache.get(cacheKey) === entry) {
                    cache.delete(cacheKey);
                }
            });
    }
    
    cache.set(cacheKey, entry);
    return response;
}

function createCacheKey(request) {
    const cacheKey = request.getCacheKey?.();
    if (!$isNothing(cacheKey)) {
        return `${assignID($classOf(request))}#${cacheKey}`;
    }
}
