import { HandleResult } from "../src/handle-result";
import { expect } from "chai";

describe("HandleResult.Handled follows or logic table", () => {
    describe("HandleResult.Handled", () => {
        const result = HandleResult.Handled
        expect(result.or(HandleResult.Handled)).to.equal(HandleResult.Handled);
        expect(result.or(HandleResult.HandledAndStop)).to.equal(HandleResult.HandledAndStop);
        expect(result.or(HandleResult.NotHandled)).to.equal(HandleResult.Handled);
        expect(result.or(HandleResult.NotHandledAndStop)).to.equal(HandleResult.HandledAndStop);
    });

    describe("HandleResult.HandledAndStop", () => {
        const result = HandleResult.HandledAndStop;
        expect(result.or(HandleResult.Handled)).to.equal(HandleResult.HandledAndStop);
        expect(result.or(HandleResult.HandledAndStop)).to.equal(HandleResult.HandledAndStop);
        expect(result.or(HandleResult.NotHandled)).to.equal(HandleResult.HandledAndStop);
        expect(result.or(HandleResult.NotHandledAndStop)).to.equal(HandleResult.HandledAndStop);
    });

    describe("HandleResult.NotHandled", () => {
        const result = HandleResult.NotHandled
        expect(result.or(HandleResult.Handled)).to.equal(HandleResult.Handled);
        expect(result.or(HandleResult.HandledAndStop)).to.equal(HandleResult.HandledAndStop);
        expect(result.or(HandleResult.NotHandled)).to.equal(HandleResult.NotHandled);
        expect(result.or(HandleResult.NotHandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
    });

    describe("HandleResult.NotHandledAndStop", () => {
        const result = HandleResult.NotHandledAndStop
        expect(result.or(HandleResult.Handled)).to.equal(HandleResult.HandledAndStop);
        expect(result.or(HandleResult.HandledAndStop)).to.equal(HandleResult.HandledAndStop);
        expect(result.or(HandleResult.NotHandled)).to.equal(HandleResult.NotHandledAndStop);
        expect(result.or(HandleResult.NotHandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
    });
});

describe("HandleResult.Handled follows and logic table", () => {
    describe("HandleResult.Handled", () => {
        const result = HandleResult.Handled
        expect(result.and(HandleResult.Handled)).to.equal(HandleResult.Handled);
        expect(result.and(HandleResult.HandledAndStop)).to.equal(HandleResult.HandledAndStop);
        expect(result.and(HandleResult.NotHandled)).to.equal(HandleResult.NotHandled);
        expect(result.and(HandleResult.NotHandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
    });

    describe("HandleResult.HandledAndStop", () => {
        const result = HandleResult.HandledAndStop;
        expect(result.and(HandleResult.Handled)).to.equal(HandleResult.HandledAndStop);
        expect(result.and(HandleResult.HandledAndStop)).to.equal(HandleResult.HandledAndStop);
        expect(result.and(HandleResult.NotHandled)).to.equal(HandleResult.NotHandledAndStop);
        expect(result.and(HandleResult.NotHandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
    });

    describe("HandleResult.NotHandled", () => {
        const result = HandleResult.NotHandled
        expect(result.and(HandleResult.Handled)).to.equal(HandleResult.NotHandled);
        expect(result.and(HandleResult.HandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
        expect(result.and(HandleResult.NotHandled)).to.equal(HandleResult.NotHandled);
        expect(result.and(HandleResult.NotHandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
    });

    describe("HandleResult.NotHandledAndStop", () => {
        const result = HandleResult.NotHandledAndStop
        expect(result.and(HandleResult.Handled)).to.equal(HandleResult.NotHandledAndStop);
        expect(result.and(HandleResult.HandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
        expect(result.and(HandleResult.NotHandled)).to.equal(HandleResult.NotHandledAndStop);
        expect(result.and(HandleResult.NotHandledAndStop)).to.equal(HandleResult.NotHandledAndStop);
    });
});