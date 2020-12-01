import { 
    $isNothing, $isFunction, $isString,
    createKey
}
 from "miruken-core";
import { BindingMetadata } from "./binding-metadata";
import { BindingConstraint } from "./binding-constraint";
import { NamedConstraint } from "./named";

const _ = createKey();

export class ConstraintBuilder {
    constructor(metadata) {
        if ($isNothing(metadata)) {
            metadata = new BindingMetadata()
        } else if (!(metadata instanceof BindingMetadata)) {
            if (metadata.metadata instanceof BindingMetadata) {
                metadata = metadata.metadata;
            }
        }
        if ($isNothing(metadata)) {
            throw new TypeError("The metadata argument must be a BindingMetadata or BindingSource.");
        }
        _(this).metadata = metadata;
    }

    named(name) {
        return this.require(new NamedConstraint(name));
    }

    require(...args) {
        const metadata = _(this).metadata;
        if (args.length === 2 && $isString(args[0])) {
           metadata.set(args[0], args[1]);
           return this;
        } 
        if (args.length === 1) {
            const arg = args[0];
            if (arg instanceof BindingMetadata) {
                if (!$isNothing(arg.name)) {
                    metadata.name = arg.name; 
                }
                arg.mergeInto(metadata);
                return this;
            }
            if (arg instanceof BindingConstraint) {
                arg.require(metadata);
                return this;
            }
            if ($isFunction(arg)) {
                const constranint = arg();
                if (constranint instanceof BindingConstraint) {
                    constranint.require(metadata);
                    return this;
                }
            }
        }
        throw new Error("require expects a key/value, BindingMetadata, BindingConstraint or constraint decorator.");
    }

    build() { return _(this).metadata; }
}

