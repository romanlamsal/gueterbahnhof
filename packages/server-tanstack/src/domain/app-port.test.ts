import { describe, expect, it } from "vitest"
import { describeAppPort, parsePort, resolveAppPort } from "./app-port.ts"

describe("parsePort", () => {
    it("accepts a plain integer in range", () => {
        expect(parsePort("3001")).toBe(3001)
        expect(parsePort(" 3001 ")).toBe(3001)
    })

    it("treats anything that is not a plain port as absent", () => {
        // A typo must never become a target we then proxy to.
        for (const value of [undefined, "", "abc", "30 01", "3001a", "-1", "0", "65536", "3001.5", "0x10"]) {
            expect(parsePort(value)).toBeUndefined()
        }
    })
})

describe("resolveAppPort", () => {
    it("prefers the declared field", () => {
        expect(resolveAppPort({ port: 20001, env: { PORT: "3001" } })).toBe(20001)
    })

    it("falls back to the Env, which is how every App configured before the field says its port", () => {
        expect(resolveAppPort({ port: undefined, env: { PORT: "3001" } })).toBe(3001)
    })

    it("is undefined when neither says anything", () => {
        expect(resolveAppPort({ env: {} })).toBeUndefined()
        expect(resolveAppPort({})).toBeUndefined()
    })

    it("ignores an unusable Env value rather than inventing a port", () => {
        expect(resolveAppPort({ env: { PORT: "not-a-port" } })).toBeUndefined()
    })
})

describe("describeAppPort", () => {
    it("marks an Env-only port as inherited, so the form can offer to promote it", () => {
        expect(describeAppPort({ env: { PORT: "3001" } })).toEqual({ port: 3001, inherited: true })
    })

    it("does not mark a declared port as inherited, even when the Env still carries one", () => {
        expect(describeAppPort({ port: 20001, env: { PORT: "3001" } })).toEqual({ port: 20001, inherited: false })
    })

    it("reports nothing to inherit when the Env has no usable port", () => {
        expect(describeAppPort({ env: {} })).toEqual({ port: undefined, inherited: false })
    })
})
