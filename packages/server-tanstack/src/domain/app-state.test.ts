import { describe, expect, it } from "vitest"
import { deriveAppState } from "./app-state.ts"

describe("deriveAppState", () => {
    it("is 'no-artifact' when the app directory is missing, whatever pm2 says", () => {
        expect(deriveAppState(undefined, false)).toBe("no-artifact")
        expect(deriveAppState("online", false)).toBe("no-artifact")
    })

    it("is 'online' for a running process", () => {
        expect(deriveAppState("online", true)).toBe("online")
    })

    it("is 'pending' while launching or stopping", () => {
        expect(deriveAppState("launching", true)).toBe("pending")
        expect(deriveAppState("stopping", true)).toBe("pending")
    })

    it("is 'stopped' for anything else", () => {
        expect(deriveAppState("stopped", true)).toBe("stopped")
        expect(deriveAppState("errored", true)).toBe("stopped")
        expect(deriveAppState(undefined, true)).toBe("stopped")
        expect(deriveAppState("something-new", true)).toBe("stopped")
    })
})
