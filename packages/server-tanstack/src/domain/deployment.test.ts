import { describe, expect, it } from "vitest"
import {
    canStartDeployment,
    createDeployment,
    type Deployment,
    isTerminal,
    transitionDeployment,
} from "./deployment.ts"

describe("deployment lifecycle", () => {
    it("starts in 'extracting'", () => {
        const deployment = createDeployment("dep-1", "my-app")

        expect(deployment).toEqual({ id: "dep-1", appName: "my-app", state: "extracting" })
    })

    it.each([
        ["extracting", "starting"],
        ["extracting", "failed"],
        ["starting", "succeeded"],
        ["starting", "failed"],
    ] as const)("allows %s -> %s", (from, to) => {
        const deployment: Deployment = { id: "dep-1", appName: "a", state: from }

        expect(transitionDeployment(deployment, to)?.state).toBe(to)
    })

    it.each([
        ["extracting", "succeeded"],
        ["succeeded", "starting"],
        ["succeeded", "failed"],
        ["failed", "starting"],
        ["failed", "succeeded"],
        ["starting", "extracting"],
    ] as const)("rejects %s -> %s", (from, to) => {
        const deployment: Deployment = { id: "dep-1", appName: "a", state: from }

        expect(transitionDeployment(deployment, to)).toBeUndefined()
    })

    it("carries a reason into 'failed'", () => {
        const deployment = createDeployment("dep-1", "my-app")

        const failed = transitionDeployment(deployment, "failed", "boom")

        expect(failed).toEqual({ id: "dep-1", appName: "my-app", state: "failed", reason: "boom" })
    })

    it("does not mutate the input deployment", () => {
        const deployment = createDeployment("dep-1", "my-app")

        transitionDeployment(deployment, "starting")

        expect(deployment.state).toBe("extracting")
    })

    it("knows terminal states", () => {
        expect(isTerminal({ id: "d", appName: "a", state: "extracting" })).toBe(false)
        expect(isTerminal({ id: "d", appName: "a", state: "starting" })).toBe(false)
        expect(isTerminal({ id: "d", appName: "a", state: "succeeded" })).toBe(true)
        expect(isTerminal({ id: "d", appName: "a", state: "failed" })).toBe(true)
    })

    it("allows a new deployment only when none is active", () => {
        expect(canStartDeployment(undefined)).toBe(true)
        expect(canStartDeployment({ id: "d", appName: "a", state: "succeeded" })).toBe(true)
        expect(canStartDeployment({ id: "d", appName: "a", state: "failed" })).toBe(true)
        expect(canStartDeployment({ id: "d", appName: "a", state: "extracting" })).toBe(false)
        expect(canStartDeployment({ id: "d", appName: "a", state: "starting" })).toBe(false)
    })
})
