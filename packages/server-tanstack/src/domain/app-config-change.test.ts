import { describe, expect, it } from "vitest"
import { needsRecreate } from "./app-config-change.ts"

const base = { id: "id-1", name: "my-app", entry: "index.js", env: { A: "1" } }

describe("needsRecreate", () => {
    it("is false when nothing process-relevant changed", () => {
        expect(needsRecreate(base, { ...base })).toBe(false)
    })

    it("is true on an entry change", () => {
        expect(needsRecreate(base, { ...base, entry: "other.js" })).toBe(true)
    })

    it("is true on a rename", () => {
        expect(needsRecreate(base, { ...base, name: "renamed" })).toBe(true)
    })

    it("is true on a changed env value", () => {
        expect(needsRecreate(base, { ...base, env: { A: "2" } })).toBe(true)
    })

    it("is true on an added env var", () => {
        expect(needsRecreate(base, { ...base, env: { A: "1", B: "2" } })).toBe(true)
    })

    it("is true on a removed env var", () => {
        expect(needsRecreate(base, { ...base, env: {} })).toBe(true)
    })

    // The Port lives outside the Env now, so without comparing it an App would
    // go on binding the old port after the field changed.
    it("is true when the port is set, changed or cleared", () => {
        expect(needsRecreate(base, { ...base, port: 20001 })).toBe(true)
        expect(needsRecreate({ ...base, port: 20001 }, { ...base, port: 20002 })).toBe(true)
        expect(needsRecreate({ ...base, port: 20001 }, base)).toBe(true)
    })

    it("is false when only the port stays the same", () => {
        expect(needsRecreate({ ...base, port: 20001 }, { ...base, port: 20001 })).toBe(false)
    })
})
