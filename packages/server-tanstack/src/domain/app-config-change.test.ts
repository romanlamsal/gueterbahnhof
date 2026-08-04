import { describe, expect, it } from "vitest"
import { decideRestart } from "./app-config-change.ts"

const base = { id: "id-1", name: "my-app", entry: "index.js", env: { A: "1" } }

describe("decideRestart", () => {
    it("does nothing when nothing process-relevant changed", () => {
        expect(decideRestart(base, { ...base })).toBe("none")
    })

    it("restarts on an entry change", () => {
        expect(decideRestart(base, { ...base, entry: "other.js" })).toBe("restart")
    })

    it("restarts on a rename", () => {
        expect(decideRestart(base, { ...base, name: "renamed" })).toBe("restart")
    })

    it("recreates on an env value change (pm2 caches env)", () => {
        expect(decideRestart(base, { ...base, env: { A: "2" } })).toBe("recreate")
    })

    it("recreates on an added env var", () => {
        expect(decideRestart(base, { ...base, env: { A: "1", B: "2" } })).toBe("recreate")
    })

    it("recreates on a removed env var", () => {
        expect(decideRestart(base, { ...base, env: {} })).toBe("recreate")
    })

    it("recreates when both env and entry changed (recreate wins)", () => {
        expect(decideRestart(base, { ...base, entry: "other.js", env: { A: "2" } })).toBe("recreate")
    })
})
