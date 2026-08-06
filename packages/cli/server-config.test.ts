import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadServerConfigFile } from "./server-config.js"

describe("loadServerConfigFile", () => {
    let dir: string
    let configPath: string
    const originalEnv = { ...process.env }

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "gbhf-config-"))
        configPath = join(dir, ".gueterbahnhof")
    })

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true })
        for (const key of Object.keys(process.env)) {
            if (key.startsWith("GUETERBAHNHOF_") && !(key in originalEnv)) {
                delete process.env[key]
            }
        }
        Object.assign(process.env, originalEnv)
    })

    it("fills environment variables from the file", () => {
        writeFileSync(configPath, "GUETERBAHNHOF_APP_DIR=/srv/apps\nGUETERBAHNHOF_PORT=4444\n")

        const result = loadServerConfigFile(configPath)

        expect(result).toMatchObject({
            loaded: true,
            applied: expect.arrayContaining(["GUETERBAHNHOF_APP_DIR"]),
        })
        expect(process.env.GUETERBAHNHOF_APP_DIR).toBe("/srv/apps")
        expect(process.env.GUETERBAHNHOF_PORT).toBe("4444")
    })

    it("never overrides a variable that is already set — env wins over the file", () => {
        process.env.GUETERBAHNHOF_PORT = "9999"
        writeFileSync(configPath, "GUETERBAHNHOF_PORT=4444\nGUETERBAHNHOF_APP_DIR=/srv/apps\n")

        const result = loadServerConfigFile(configPath)

        expect(process.env.GUETERBAHNHOF_PORT).toBe("9999")
        expect(process.env.GUETERBAHNHOF_APP_DIR).toBe("/srv/apps")
        expect(result.applied).not.toContain("GUETERBAHNHOF_PORT")
    })

    it("is a no-op when the file does not exist", () => {
        const result = loadServerConfigFile(join(dir, "nope"))

        expect(result).toEqual({ loaded: false, applied: [] })
    })

    it("honours dotenv semantics: comments, quotes and values containing '='", () => {
        writeFileSync(
            configPath,
            [
                "# a comment",
                "GUETERBAHNHOF_API_KEY=key-with=equals&symbols",
                'GUETERBAHNHOF_APP_DIR="/srv/with space"',
                "",
            ].join("\n"),
        )

        loadServerConfigFile(configPath)

        expect(process.env.GUETERBAHNHOF_API_KEY).toBe("key-with=equals&symbols")
        expect(process.env.GUETERBAHNHOF_APP_DIR).toBe("/srv/with space")
    })

    it("warns when a file holding an API key is readable by others", () => {
        writeFileSync(configPath, "GUETERBAHNHOF_API_KEY=secret\n")
        chmodSync(configPath, 0o644)
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

        loadServerConfigFile(configPath)

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("readable"))
        warn.mockRestore()
    })

    it("does not warn about permissions when there is no secret in the file", () => {
        writeFileSync(configPath, "GUETERBAHNHOF_PORT=4444\n")
        chmodSync(configPath, 0o644)
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

        loadServerConfigFile(configPath)

        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })

    it("does not warn when the file is owner-only", () => {
        writeFileSync(configPath, "GUETERBAHNHOF_API_KEY=secret\n")
        chmodSync(configPath, 0o600)
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

        loadServerConfigFile(configPath)

        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })
})
