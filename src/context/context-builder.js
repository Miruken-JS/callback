import { $isNothing } from "miruken-core";

import { 
    HandlerBuilder, InferenceHandler
} from "miruken-callback";

import { Context } from "./context";

export class ContextBuilder extends HandlerBuilder {
    constructor(parent) {
        super();
        _(this).parent = parent;
    }

    createHandler(selectedTypes, explicitHandlers) {
        const parent  = _(this).parent,
              context = $isNothing(parent) ? new Context() : parent.newChild();
        return context
            .addHandlers(explicitHandlers)
            .addHandlers(new InferenceHandler(selectedTypes));
    }    
}