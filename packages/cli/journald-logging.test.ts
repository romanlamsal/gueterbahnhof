import { describe, expect, it, vi } from "vitest"
import { applyJournaldPriorityPrefixes } from "./journald-logging.js"

// A fake console per test: the real one is shared, and this machine happens to
// run with JOURNAL_STREAM already set, which would make the env implicit.
const fakeConsole = () => ({ error: vi.fn(), warn: vi.fn() })
const underJournald = { JOURNAL_STREAM: "8:12345" }

describe("applyJournaldPriorityPrefixes", () => {
    it("does nothing when journald is not attached", () => {
        const target = fakeConsole()

        const applied = applyJournaldPriorityPrefixes({ env: {}, target })
        target.error("boom")

        expect(applied).toBe(false)
        expect(target.error).toHaveBeenCalledWith("boom")
    })

    it("prefixes errors with <3> and warnings with <4> under journald", () => {
        const inner = fakeConsole()
        const target = { ...inner }

        const applied = applyJournaldPriorityPrefixes({ env: underJournald, target })
        target.error("boom")
        target.warn("careful")

        expect(applied).toBe(true)
        expect(inner.error).toHaveBeenCalledWith("<3>boom")
        expect(inner.warn).toHaveBeenCalledWith("<4>careful")
    })

    it("keeps every argument after the first, so formatting still works", () => {
        const inner = fakeConsole()
        const target = { ...inner }
        const cause = new Error("cause")

        applyJournaldPriorityPrefixes({ env: underJournald, target })
        target.error("failed:", cause, 42)

        expect(inner.error).toHaveBeenCalledWith("<3>failed:", cause, 42)
    })

    it("prefixes a non-string first argument without mangling it", () => {
        const inner = fakeConsole()
        const target = { ...inner }
        const failure = new Error("thrown directly")

        applyJournaldPriorityPrefixes({ env: underJournald, target })
        target.error(failure)

        expect(inner.error).toHaveBeenCalledWith("<3>", failure)
    })

    it("is idempotent — a second call does not double the prefix", () => {
        const inner = fakeConsole()
        const target = { ...inner }

        applyJournaldPriorityPrefixes({ env: underJournald, target })
        applyJournaldPriorityPrefixes({ env: underJournald, target })
        target.error("boom")

        expect(inner.error).toHaveBeenCalledWith("<3>boom")
    })
})
