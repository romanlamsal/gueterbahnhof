import { describe, expect, it } from "vitest"
import { ASSIGNABLE_PORT_RANGE, candidatePorts, claimedPorts, needsAssignedPort } from "./port-assignment.ts"

describe("ASSIGNABLE_PORT_RANGE", () => {
    it("sits below the kernel's ephemeral floor", () => {
        // Linux hands out 32768-60999 as source ports for outbound
        // connections, and IANA's "dynamic" range sits entirely inside it — a
        // port from either can be taken between our check and the App's bind.
        expect(ASSIGNABLE_PORT_RANGE.to).toBeLessThan(32768)
        // ...and clear of Kubernetes NodePort's 30000-32767.
        expect(ASSIGNABLE_PORT_RANGE.to).toBeLessThan(30000)
        expect(ASSIGNABLE_PORT_RANGE.from).toBeGreaterThan(1023)
    })
})

describe("needsAssignedPort", () => {
    it("is true only for an App that declares a Proxy Host and has no port at all", () => {
        expect(needsAssignedPort({ name: "api", proxyHost: "api.example.com" })).toBe(true)
    })

    it("is false without a Proxy Host — no App that exists today is eligible", () => {
        expect(needsAssignedPort({ name: "api" })).toBe(false)
        expect(needsAssignedPort({ name: "api", env: { PORT: "3001" } })).toBe(false)
    })

    it("is false when the App already has a port, however it says so", () => {
        expect(needsAssignedPort({ name: "api", proxyHost: "api.example.com", port: 20001 })).toBe(false)
        // The pinned-in-nginx case: an Env PORT must never be replaced.
        expect(needsAssignedPort({ name: "api", proxyHost: "api.example.com", env: { PORT: "3001" } })).toBe(false)
    })
})

describe("claimedPorts", () => {
    it("counts a port however the App says it", () => {
        const claimed = claimedPorts([{ port: 20001 }, { env: { PORT: "3001" } }])

        expect([...claimed].sort((x, y) => x - y)).toEqual([3001, 20001])
    })

    it("includes what the caller reserves, which is how our own port stays ours", () => {
        expect(claimedPorts([], [4444]).has(4444)).toBe(true)
    })

    it("ignores an App with nothing to claim", () => {
        expect(claimedPorts([{}, { env: { PORT: "nonsense" } }]).size).toBe(0)
    })
})

describe("candidatePorts", () => {
    const range = { from: 20000, to: 20004 }

    it("walks the range in order", () => {
        expect([...candidatePorts(new Set(), range)]).toEqual([20000, 20001, 20002, 20003, 20004])
    })

    it("skips what is already claimed", () => {
        expect([...candidatePorts(new Set([20000, 20002]), range)]).toEqual([20001, 20003, 20004])
    })

    it("yields nothing once the range is exhausted, rather than wrapping or inventing", () => {
        expect([...candidatePorts(new Set([20000, 20001, 20002, 20003, 20004]), range)]).toEqual([])
    })

    it("defaults to the assignable range", () => {
        const first = candidatePorts(new Set()).next()

        expect(first.value).toBe(ASSIGNABLE_PORT_RANGE.from)
    })
})
