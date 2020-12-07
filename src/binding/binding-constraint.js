export class BindingConstraint {
    /**
     * Requires the binding metadata to be present.
     * @method require
     * @param  {BindingMetadata} metadata  -  binding metadata
     */       
    require(metadata) {
        throw new Error(`${this.constructor.name} did not implement BindingConstraint.require.`);
    }

    /**
     * Checks if the constraint satisfies the binding metadata.
     * @method matches
     * @param  {BindingMetadata} metadata  -  binding metadata
     * @returns {Boolean} true if the metadata is satified.
     */     
    matches(metadata) {
        throw new Error(`${this.constructor.name} did not implement BindingConstraint.matches.`);
    }
}

