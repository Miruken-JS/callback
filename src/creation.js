import {
    Base, $isPromise, $isNothing,
    conformsTo, createKeyChain
} from "miruken-core";

import CallbackControl from "./callback-control";
import { creates } from "./callback-policy";

const _ = createKeyChain();

/**
 * Callback representing the covariant creation of a type.
 * @class Creation
 * @constructor
 * @param   {Object}   callback  -  callback
 * @param   {boolean}  many      -  creation cardinality
 * @extends Base
 */
@conformsTo(CallbackControl)
export class Creation extends Base {
    constructor(type, many) {
        if ($isNothing(type)) {
            throw new TypeError("The type argument is required.");
        }
        super();
        const _this = _(this);
        _this.type      = type;
        _this.many      = !!many;
        _this.instances = [];
        _this.promises  = [];
    }
    
    get isMany()         { return _(this).many; }
    get type()           { return _(this).type; }
    get instances()      { return _(this).instances; }
    get callbackPolicy() { return creates.policy; }        
    get callbackResult() {
        let { result, instances, promises} = _(this);
        if (result === undefined) {
            if (promises.length == 0) {
                _(this).result = result = this.isMany ? instances : instances[0];
            } else {
                _(this).result = result = this.isMany
                    ? Promise.all(promises).then(() => instances)
                    : Promise.all(promises).then(() => instances[0]);
            }
        }
        return result;
    }
    set callbackResult(value) { _(this).result = value; }

    addInstance(instance) {
        if ($isNothing(instance)) return;
        if ($isPromise(instance)) {
            _(this).promises.push(instance.then(res => {
                if (res != null) {
                    _(this).instances.push(res);
                }
            }));
        } else {
            _(this).instances.push(instance);
        }
        delete _(this).result;
    }

    dispatch(handler, greedy, composer) {
        const count = _(this).instances.length;
        return creates.dispatch(handler, this, this, this.type,
            composer, this.isMany, this.addInstance.bind(this)) || 
            _(this).instances.length > count;     
    }

    toString() {
        return `Creation ${this.isMany ? "many ": ""}| ${this.type}`;
    }  
}

export default Creation;
