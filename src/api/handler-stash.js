import { 
    $isNothing, $isFunction, $isPromise,
    $classOf
} from "miruken-core";
import { Handler } from "../handler";
import { NotHandledError } from "../errors";
import { StashAction } from "./stash";

Handler.implement({
    stashGet(key) {
        const get = new StashAction.Get(key);
        if (!this.handle(get)) {
            throw new NotHandledError(get);
        }
        return get.value;
    },
    stashPut(value, key) {
        const actualKey = key || $classOf(value);
        if ($isNothing(actualKey)) {
            throw new Error("The key could not be inferred.");
        }
        const put = new StashAction.Put(actualKey, value);
        if (!this.handle(put)) {
            throw new NotHandledError(put);
        }
    },
    stashDrop(key) {
        const drop = new StashAction.Drop(key);
        if (!this.handle(drop)) {
            throw new NotHandledError(drop);
        }
    },
    stashTryGet(key) {
        const get = new StashAction.Get(key);
        if (this.handle(get)) return get.value;
    },
    stashGetOrPut(key, value) {
        let data = this.stashTryGet(key);
        if ($isNothing(data)) {
            data = $isFunction(value) ? value() : value;
            if ($isPromise(data)) {
                return data.then(result => {
                    this.stashPut(result, key);
                    return result;
                })
            }
            this.stashPut(data, key);
        }
        return data;
    }
});