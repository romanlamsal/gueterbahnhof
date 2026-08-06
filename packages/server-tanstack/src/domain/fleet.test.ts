import { describe, expect, it } from "vitest"
import { findOrphanProcessNames } from "./fleet.ts"

describe("findOrphanProcessNames", () => {
    it("finds labelled processes that no longer have a config", () => {
        expect(findOrphanProcessNames(["a", "b"], ["a", "b", "gone"])).toEqual(["gone"])
    })

    it("is empty when every running process is configured", () => {
        expect(findOrphanProcessNames(["a", "b"], ["a"])).toEqual([])
    })

    it("does not treat configured-but-not-running apps as orphans", () => {
        expect(findOrphanProcessNames(["a", "b", "c"], [])).toEqual([])
    })

    it("dedupes repeated process names", () => {
        expect(findOrphanProcessNames([], ["dup", "dup"])).toEqual(["dup"])
    })
})
