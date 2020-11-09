import { Metadata, $isNothing } from "miruken-core";

const unmanagedMetadataKey = Symbol("unmanaged-metadata")

const unmanagedMetadata = Metadata.decorator(unmanagedMetadataKey,
    (target, key, descriptor, args) => {
        if (!$isNothing(descriptor)) {
            throw new SyntaxError("@unmanaged can only be applied to classes.");
        }
        unmanagedMetadata.getOrCreateOwn(target, () => true);
    });

export const unmanaged = unmanagedMetadata();

unmanaged.isDefined = type => unmanagedMetadata.get(type) === true;
