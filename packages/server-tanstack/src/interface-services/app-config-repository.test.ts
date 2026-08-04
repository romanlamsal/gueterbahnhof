import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { type AppConfigRepository, createAppConfigRepository } from "./app-config-repository.ts"

describe("appConfigRepository", () => {
    let appsDir: string
    let repository: AppConfigRepository

    beforeEach(() => {
        appsDir = mkdtempSync(join(tmpdir(), "gbhf-configs-"))
        repository = createAppConfigRepository(appsDir)
    })

    afterEach(() => {
        rmSync(appsDir, { recursive: true, force: true })
    })

    it("creates a config file and returns the config with defaults", async () => {
        const created = await repository.createAppConfig("app-1", "my app")

        expect(created).toEqual({ id: "app-1", name: "my app", env: {} })

        const onDisk = JSON.parse(readFileSync(join(appsDir, "app-1.json"), "utf8"))
        expect(onDisk).toEqual({ id: "app-1", name: "my app", env: {} })
    })

    it("refuses to create a config that already exists", async () => {
        await repository.createAppConfig("app-1", "first")

        const second = await repository.createAppConfig("app-1", "second")

        expect(second).toBeUndefined()
        const reread = await repository.getAppConfig("app-1")
        expect(reread?.name).toBe("first")
    })

    it("returns undefined for a missing config", async () => {
        expect(await repository.getAppConfig("nope")).toBeUndefined()
    })

    it("merges a dotenv sidecar file into env on read", async () => {
        await repository.createAppConfig("app-1", "my app", { FROM_CONFIG: "a", OVERLAP: "config" })
        writeFileSync(join(appsDir, "app-1.env"), "FROM_SIDECAR=b\nOVERLAP=sidecar\n")

        const config = await repository.getAppConfig("app-1")

        expect(config?.env).toEqual({ FROM_CONFIG: "a", FROM_SIDECAR: "b", OVERLAP: "sidecar" })
    })

    it("updates a config, persists it and returns previous and next", async () => {
        await repository.createAppConfig("app-1", "my app")

        const result = await repository.updateAppConfig("app-1", { entry: "dist/index.js" })

        expect(result).toBeDefined()
        const [prev, next] = result as [unknown, { entry?: string }]
        expect(prev).toEqual({ id: "app-1", name: "my app", env: {} })
        expect(next.entry).toBe("dist/index.js")

        const reread = await repository.getAppConfig("app-1")
        expect(reread?.entry).toBe("dist/index.js")
    })

    it("returns undefined when updating a missing config", async () => {
        expect(await repository.updateAppConfig("nope", { name: "x" })).toBeUndefined()
    })

    it("finds a config by app name", async () => {
        await repository.createAppConfig("app-1", "one")
        await repository.createAppConfig("app-2", "two")

        expect((await repository.findAppConfigByName("two"))?.id).toBe("app-2")
        expect(await repository.findAppConfigByName("nope")).toBeUndefined()
    })

    it("lists all configs, ignoring non-json files", async () => {
        await repository.createAppConfig("app-1", "one")
        await repository.createAppConfig("app-2", "two")
        writeFileSync(join(appsDir, "app-1.env"), "A=b\n")

        const configs = await repository.listAppConfigs()

        expect(configs.map(config => config.name).sort()).toEqual(["one", "two"])
    })
})
