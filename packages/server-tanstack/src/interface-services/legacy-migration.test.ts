import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { migrateLegacyAppsJson } from "./legacy-migration.ts"

describe("migrateLegacyAppsJson", () => {
    let baseDir: string
    let appsDir: string

    beforeEach(() => {
        baseDir = mkdtempSync(join(tmpdir(), "gbhf-migration-"))
        appsDir = join(baseDir, "apps")
        mkdirSync(appsDir)
    })

    afterEach(() => {
        rmSync(baseDir, { recursive: true, force: true })
    })

    const readConfigs = () =>
        readdirSync(appsDir)
            .filter(file => file.endsWith(".json"))
            .map(file => JSON.parse(readFileSync(join(appsDir, file), "utf8")))

    it("migrates a legacy apps.json into per-app config files and renames the original", async () => {
        writeFileSync(
            join(baseDir, "apps.json"),
            JSON.stringify({
                "app-a": { name: "app-a", entry: "dist/index.js", env: { PORT: "3001" } },
                "app-b": { name: "app-b", entry: "server.js" },
            }),
        )

        const result = migrateLegacyAppsJson(baseDir, appsDir)

        expect(result).toEqual({ migrated: 2, skipped: 0 })

        const configs = readConfigs().sort((a, b) => a.name.localeCompare(b.name))
        expect(configs).toHaveLength(2)
        expect(configs[0]).toMatchObject({ name: "app-a", entry: "dist/index.js", env: { PORT: "3001" } })
        expect(configs[0].id).toBeTruthy()
        expect(configs[1]).toMatchObject({ name: "app-b", entry: "server.js", env: {} })

        expect(existsSync(join(baseDir, "apps.json"))).toBe(false)
        expect(existsSync(join(baseDir, "apps.json.migrated"))).toBe(true)
    })

    it("moves the legacy artifact directory (<dir>/<name>) to the app's new home (<appsDir>/<id>)", () => {
        writeFileSync(join(baseDir, "apps.json"), JSON.stringify({ "app-a": { name: "app-a", entry: "index.js" } }))
        mkdirSync(join(baseDir, "app-a"))
        writeFileSync(join(baseDir, "app-a", "index.js"), "console.log('legacy artifact')")

        migrateLegacyAppsJson(baseDir, appsDir)

        const config = readConfigs()[0]
        expect(existsSync(join(baseDir, "app-a"))).toBe(false)
        expect(readFileSync(join(appsDir, config.id, "index.js"), "utf8")).toBe("console.log('legacy artifact')")
    })

    it("does nothing when there is no legacy file", () => {
        expect(migrateLegacyAppsJson(baseDir, appsDir)).toBeUndefined()
        expect(readConfigs()).toHaveLength(0)
    })

    it("is a no-op on the second boot", () => {
        writeFileSync(join(baseDir, "apps.json"), JSON.stringify({ "app-a": { name: "app-a", entry: "x.js" } }))

        migrateLegacyAppsJson(baseDir, appsDir)
        const second = migrateLegacyAppsJson(baseDir, appsDir)

        expect(second).toBeUndefined()
        expect(readConfigs()).toHaveLength(1)
    })

    it("skips apps whose name already exists as a config", () => {
        writeFileSync(join(appsDir, "existing.json"), JSON.stringify({ id: "existing", name: "app-a", env: {} }))
        writeFileSync(
            join(baseDir, "apps.json"),
            JSON.stringify({
                "app-a": { name: "app-a", entry: "x.js" },
                "app-b": { name: "app-b", entry: "y.js" },
            }),
        )

        const result = migrateLegacyAppsJson(baseDir, appsDir)

        expect(result).toEqual({ migrated: 1, skipped: 1 })
        expect(readConfigs()).toHaveLength(2)
    })

    it("copes with a corrupt legacy file by leaving it alone", () => {
        writeFileSync(join(baseDir, "apps.json"), "not json at all")

        const result = migrateLegacyAppsJson(baseDir, appsDir)

        expect(result).toBeUndefined()
        expect(existsSync(join(baseDir, "apps.json"))).toBe(true)
    })
})
