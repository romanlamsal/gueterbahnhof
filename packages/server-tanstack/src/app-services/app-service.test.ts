import { describe, expect, it, vi } from "vitest"
import type { AppConfig } from "@/interface-services/app-config-repository.ts"
import { createAppService } from "./app-service.ts"

const makeFakes = (initialConfigs: AppConfig[] = [], { processExists = true } = {}) => {
    const configs = new Map(initialConfigs.map(config => [config.id, structuredClone(config)]))

    const configRepository = {
        async getAppConfig(appId: string) {
            return configs.get(appId)
        },
        async createAppConfig(appId: string, name: string, env?: AppConfig["env"]) {
            if (configs.has(appId)) {
                return undefined
            }
            const config = { id: appId, name, env: env ?? {} }
            configs.set(appId, config)
            return config
        },
        async updateAppConfig(appId: string, partial: Partial<AppConfig>): Promise<[AppConfig, AppConfig] | void> {
            const current = configs.get(appId)
            if (!current) {
                return
            }
            const next = { ...current, ...partial }
            configs.set(appId, next)
            return [current, next]
        },
        async deleteAppConfig(appId: string) {
            configs.delete(appId)
        },
        async findAppConfigByName(name: string) {
            return [...configs.values()].find(config => config.name === name)
        },
        async listAppConfigs() {
            return [...configs.values()]
        },
    }

    const processManager = {
        getAppProcess: vi.fn(async () => (processExists ? { pm2_env: { status: "online" } } : undefined)),
        startAppProcess: vi.fn(async () => ({})),
        stopAppProcess: vi.fn(async () => ({})),
        deleteAppProcess: vi.fn(async () => ({})),
        startOrRestartAppProcess: vi.fn(async () => ({})),
    }

    const artifactStore = {
        getAppDir: (appId: string) => `/apps/${appId}`,
        deleteAppDir: vi.fn(async () => undefined),
        hasArtifact: vi.fn(async () => true),
    }

    const service = createAppService({
        configRepository: configRepository as never,
        processManager: processManager as never,
        artifactStore: artifactStore as never,
    })

    return { service, configRepository, processManager, artifactStore, configs }
}

const baseConfig: AppConfig = { id: "id-1", name: "my-app", entry: "index.js", env: { A: "1" } }

describe("appService.updateAppConfig", () => {
    it("does not touch the process when nothing relevant changed", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        const result = await service.updateAppConfig("id-1", { name: "my-app" })

        expect(result).toMatchObject({ ok: true })
        expect(processManager.stopAppProcess).not.toHaveBeenCalled()
        expect(processManager.deleteAppProcess).not.toHaveBeenCalled()
        expect(processManager.startAppProcess).not.toHaveBeenCalled()
    })

    it("stops and starts on an entry change, with the app dir as cwd", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        await service.updateAppConfig("id-1", { entry: "other.js" })

        expect(processManager.stopAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.deleteAppProcess).not.toHaveBeenCalled()
        expect(processManager.startAppProcess).toHaveBeenCalledWith({
            name: "my-app",
            entry: "other.js",
            env: { A: "1" },
            cwd: "/apps/id-1",
        })
    })

    it("stops AND deletes the OLD process name on a rename, so no stray entry survives", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        await service.updateAppConfig("id-1", { name: "renamed" })

        expect(processManager.stopAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.deleteAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.startAppProcess).toHaveBeenCalledWith(expect.objectContaining({ name: "renamed" }))
    })

    it("stops AND deletes the process on an env change", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        await service.updateAppConfig("id-1", { env: { A: "2" } })

        expect(processManager.stopAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.deleteAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.startAppProcess).toHaveBeenCalledWith(expect.objectContaining({ env: { A: "2" } }))
    })

    it("saves the config but starts nothing when no process exists", async () => {
        const { service, processManager, configs } = makeFakes([baseConfig], { processExists: false })

        const result = await service.updateAppConfig("id-1", { entry: "other.js" })

        expect(result).toMatchObject({ ok: true })
        expect(configs.get("id-1")?.entry).toBe("other.js")
        expect(processManager.startAppProcess).not.toHaveBeenCalled()
    })

    it("rejects a rename to a name another app already uses", async () => {
        const { service, configs } = makeFakes([baseConfig, { id: "id-2", name: "other-app", env: {} }])

        const result = await service.updateAppConfig("id-2", { name: "my-app" })

        expect(result).toEqual({ ok: false, code: "name-taken" })
        expect(configs.get("id-2")?.name).toBe("other-app")
    })

    it("returns not-found for an unknown app id", async () => {
        const { service } = makeFakes([])

        expect(await service.updateAppConfig("ghost", { name: "x" })).toEqual({ ok: false, code: "not-found" })
    })
})

describe("appService.createApp", () => {
    it("creates an app", async () => {
        const { service } = makeFakes([])

        const result = await service.createApp("id-9", "fresh")

        expect(result).toMatchObject({ ok: true, config: { id: "id-9", name: "fresh" } })
    })

    it("rejects a duplicate name", async () => {
        const { service } = makeFakes([baseConfig])

        expect(await service.createApp("id-9", "my-app")).toEqual({ ok: false, code: "name-taken" })
    })
})

describe("appService.listApps", () => {
    it("derives each app's state from process status and artifact presence", async () => {
        const { service, artifactStore } = makeFakes([baseConfig, { id: "id-2", name: "empty-app", env: {} }])
        artifactStore.hasArtifact.mockImplementation((async (appId: string) => appId === "id-1") as never)

        const apps = await service.listApps()

        expect(apps).toEqual([
            { config: expect.objectContaining({ id: "id-1" }), state: "online" },
            { config: expect.objectContaining({ id: "id-2" }), state: "no-artifact" },
        ])
    })
})

describe("appService.deleteApp", () => {
    it("removes the process, the config and the app directory", async () => {
        const { service, processManager, artifactStore, configs } = makeFakes([baseConfig])

        const result = await service.deleteApp("id-1")

        expect(result).toEqual({ ok: true })
        expect(processManager.stopAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.deleteAppProcess).toHaveBeenCalledWith("my-app")
        expect(configs.has("id-1")).toBe(false)
        expect(artifactStore.deleteAppDir).toHaveBeenCalledWith("id-1")
    })

    it("returns not-found for an unknown app id", async () => {
        const { service } = makeFakes([])

        expect(await service.deleteApp("ghost")).toEqual({ ok: false, code: "not-found" })
    })
})
