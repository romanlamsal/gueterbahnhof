import { describe, expect, it } from "vitest"
import { FILTERED_ENV_SUBSTRINGS, FLEET_NAMESPACE, toStartOptions } from "./pm2-start-options.ts"

const spec = { name: "my-app", entry: "index.js", cwd: "/apps/id-1", env: { A: "1" } }

describe("toStartOptions", () => {
    it("carries the spec across unchanged", () => {
        expect(toStartOptions(spec)).toMatchObject({
            name: "my-app",
            script: "index.js",
            cwd: "/apps/id-1",
            env: { A: "1" },
            namespace: FLEET_NAMESPACE,
        })
    })

    // Without this, pm2 hands an app the server's whole process.env — which
    // holds the API Key, so any App could read it and deploy as any other App.
    it("filters our own variables out of the environment pm2 would inherit", () => {
        expect(toStartOptions(spec).filter_env).toEqual(["GUETERBAHNHOF_"])
    })

    it("filters by array rather than string, because the string form mutates process.env", () => {
        expect(Array.isArray(FILTERED_ENV_SUBSTRINGS)).toBe(true)
        expect(FILTERED_ENV_SUBSTRINGS.length).toBeGreaterThan(0)
    })

    it("covers every variable the server puts into its own environment", () => {
        // If a new GUETERBAHNHOF_* setting appears, the prefix already catches
        // it; anything named otherwise would need adding here deliberately.
        for (const name of ["GUETERBAHNHOF_API_KEY", "GUETERBAHNHOF_DIR"]) {
            expect(FILTERED_ENV_SUBSTRINGS.some(substring => name.includes(substring))).toBe(true)
        }
    })
})
