import { describe, expect, it } from "vitest"
import { toProcessSpec } from "./process-manager.ts"

const config = { name: "my-app", entry: "index.js", env: { A: "1" } }

describe("toProcessSpec", () => {
    it("runs the App inside its App Directory", () => {
        expect(toProcessSpec(config, "/apps/my-app")).toMatchObject({
            name: "my-app",
            entry: "index.js",
            cwd: "/apps/my-app",
        })
    })

    it("injects the declared Port as PORT, because that is the only way an App can learn it", () => {
        expect(toProcessSpec({ ...config, port: 20001 }, "/apps/my-app").env).toEqual({ A: "1", PORT: "20001" })
    })

    it("leaves an App with no port alone rather than inventing one", () => {
        expect(toProcessSpec(config, "/apps/my-app").env).toEqual({ A: "1" })
    })

    it("passes through an Env PORT when no field is declared, so existing Apps do not move", () => {
        expect(toProcessSpec({ ...config, env: { PORT: "3001" } }, "/apps/my-app").env).toEqual({ PORT: "3001" })
    })

    it("lets the declared Port win over a stale Env one", () => {
        expect(toProcessSpec({ ...config, env: { PORT: "3001" }, port: 20001 }, "/apps/my-app").env).toEqual({
            PORT: "20001",
        })
    })
})
