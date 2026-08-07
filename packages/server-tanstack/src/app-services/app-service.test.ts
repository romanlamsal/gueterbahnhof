import { describe, expect, it, vi } from "vitest"
import type { AppConfig, AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { ManagedProcess, ProcessManager } from "@/interface-services/process-manager.ts"
import { createAppService } from "./app-service.ts"

const makeFakes = (
    initialConfigs: AppConfig[] = [],
    { processExists = true, runningFleet = [] as ManagedProcess[], busyPorts = [] as number[] } = {},
) => {
    const configs = new Map(initialConfigs.map(config => [config.id, structuredClone(config)]))

    const configRepository: AppConfigRepository = {
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
        async updateAppConfig(appId: string, partial: Partial<AppConfig>): Promise<[AppConfig, AppConfig] | undefined> {
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

    const ok = { ok: true } as const

    const processManager: ProcessManager = {
        getAppProcess: vi.fn(async (name: string) => (processExists ? { name, status: "online" } : undefined)),
        listFleetProcesses: vi.fn(async () => runningFleet),
        startAppProcess: vi.fn(async () => ok),
        stopAppProcess: vi.fn(async () => ok),
        deleteAppProcess: vi.fn(async () => ok),
        recreateAppProcess: vi.fn(async () => ok),
    }

    const artifactStore = {
        getAppDir: (appId: string) => `/apps/${appId}`,
        deleteAppDir: vi.fn(async () => undefined),
        hasArtifact: vi.fn(async (_appId: string) => true),
    }

    // Substituted through its hand-written port (ADR-0005): no test binds a
    // real socket to find out whether a port is free.
    const portProbe = { isPortFree: vi.fn(async (port: number) => !busyPorts.includes(port)) }

    const service = createAppService({ configRepository, processManager, artifactStore, portProbe })

    return { service, configRepository, processManager, artifactStore, portProbe, configs }
}

const baseConfig: AppConfig = { id: "id-1", name: "my-app", entry: "index.js", env: { A: "1" } }

describe("appService.reconcileFleet", () => {
    it("recreates every configured app, with the app dir as cwd", async () => {
        const { service, processManager } = makeFakes([
            baseConfig,
            { id: "id-2", name: "other", entry: "s.js", env: {} },
        ])

        await service.reconcileFleet()

        expect(processManager.recreateAppProcess).toHaveBeenCalledTimes(2)
        expect(processManager.recreateAppProcess).toHaveBeenCalledWith({
            name: "my-app",
            entry: "index.js",
            env: { A: "1" },
            cwd: "/apps/id-1",
        })
    })

    it("reclaims labelled processes that have no config", async () => {
        const { service, processManager } = makeFakes([baseConfig], {
            runningFleet: [
                { name: "my-app", status: "online" },
                { name: "stale-app", status: "online" },
            ],
        })

        await service.reconcileFleet()

        expect(processManager.stopAppProcess).toHaveBeenCalledWith("stale-app")
        expect(processManager.deleteAppProcess).toHaveBeenCalledWith("stale-app")
        expect(processManager.deleteAppProcess).not.toHaveBeenCalledWith("my-app")
    })

    it("leaves foreign processes alone — only labelled ones are listed", async () => {
        const { service, processManager } = makeFakes([baseConfig], {
            runningFleet: [{ name: "my-app", status: "online" }],
        })

        await service.reconcileFleet()

        expect(processManager.stopAppProcess).not.toHaveBeenCalled()
    })
})

describe("appService.stopFleet", () => {
    it("removes only the configured apps", async () => {
        const { service, processManager } = makeFakes([baseConfig, { id: "id-2", name: "other", env: {} }])

        await service.stopFleet()

        expect(processManager.deleteAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.deleteAppProcess).toHaveBeenCalledWith("other")
        expect(processManager.deleteAppProcess).toHaveBeenCalledTimes(2)
    })
})

describe("appService.updateAppConfig", () => {
    it("does not touch the process when nothing relevant changed", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        const result = await service.updateAppConfig("id-1", { name: "my-app" })

        expect(result).toMatchObject({ ok: true })
        expect(processManager.recreateAppProcess).not.toHaveBeenCalled()
        expect(processManager.stopAppProcess).not.toHaveBeenCalled()
    })

    it("recreates on an entry change rather than restarting", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        await service.updateAppConfig("id-1", { entry: "other.js" })

        expect(processManager.recreateAppProcess).toHaveBeenCalledWith({
            name: "my-app",
            entry: "other.js",
            env: { A: "1" },
            cwd: "/apps/id-1",
        })
    })

    it("removes the OLD process name on a rename, so nothing stray survives", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        await service.updateAppConfig("id-1", { name: "renamed" })

        expect(processManager.stopAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.deleteAppProcess).toHaveBeenCalledWith("my-app")
        expect(processManager.recreateAppProcess).toHaveBeenCalledWith(expect.objectContaining({ name: "renamed" }))
    })

    it("recreates on an env change", async () => {
        const { service, processManager } = makeFakes([baseConfig])

        await service.updateAppConfig("id-1", { env: { A: "2" } })

        expect(processManager.recreateAppProcess).toHaveBeenCalledWith(expect.objectContaining({ env: { A: "2" } }))
    })

    it("saves the config but starts nothing when no process exists", async () => {
        const { service, processManager, configs } = makeFakes([baseConfig], { processExists: false })

        const result = await service.updateAppConfig("id-1", { entry: "other.js" })

        expect(result).toMatchObject({ ok: true })
        expect(configs.get("id-1")?.entry).toBe("other.js")
        expect(processManager.recreateAppProcess).not.toHaveBeenCalled()
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

        expect(await service.createApp("id-9", "fresh")).toMatchObject({
            ok: true,
            config: { id: "id-9", name: "fresh" },
        })
    })

    it("rejects a duplicate name", async () => {
        const { service } = makeFakes([baseConfig])

        expect(await service.createApp("id-9", "my-app")).toEqual({ ok: false, code: "name-taken" })
    })
})

describe("appService.listApps", () => {
    it("derives each app's state from process status and artifact presence", async () => {
        const { service, artifactStore } = makeFakes([baseConfig, { id: "id-2", name: "empty-app", env: {} }])
        artifactStore.hasArtifact.mockImplementation(async appId => appId === "id-1")

        expect(await service.listApps()).toEqual([
            { config: expect.objectContaining({ id: "id-1" }), state: "online" },
            { config: expect.objectContaining({ id: "id-2" }), state: "no-artifact" },
        ])
    })
})

describe("appService.deleteApp", () => {
    it("removes the process, the config and the app directory", async () => {
        const { service, processManager, artifactStore, configs } = makeFakes([baseConfig])

        expect(await service.deleteApp("id-1")).toEqual({ ok: true })
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

// Assignment is the only thing Gueterbahnhof persists that the operator did
// not type, so most of what matters here is which Apps it must leave alone.
describe("appService port assignment", () => {
    const proxied = (over: Partial<AppConfig> = {}): AppConfig => ({
        id: "id-1",
        name: "api",
        entry: "index.js",
        env: {},
        proxyHost: "api.example.com",
        ...over,
    })

    it("assigns a port to an App that declares a Proxy Host and has none", async () => {
        const { service, configs } = makeFakes([proxied()])

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBe(20000)
    })

    it("persists the assignment before the App is started", async () => {
        const { service, processManager, configs } = makeFakes([proxied()])

        await service.reconcileFleet()

        // The started process carries the assigned port, which can only be
        // true if the write happened first.
        expect(configs.get("id-1")?.port).toBe(20000)
        expect(processManager.recreateAppProcess).toHaveBeenCalledWith(
            expect.objectContaining({ env: expect.objectContaining({ PORT: "20000" }) }),
        )
    })

    it("leaves an App with a declared port alone, and never probes for it", async () => {
        const { service, configs, portProbe } = makeFakes([proxied({ port: 30001 })])

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBe(30001)
        expect(portProbe.isPortFree).not.toHaveBeenCalled()
    })

    it("leaves an App pinned by its Env PORT alone — the nginx case", async () => {
        const { service, configs, portProbe } = makeFakes([proxied({ env: { PORT: "3001" } })])

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBeUndefined()
        expect(configs.get("id-1")?.env).toEqual({ PORT: "3001" })
        expect(portProbe.isPortFree).not.toHaveBeenCalled()
    })

    it("leaves an App with no Proxy Host completely untouched", async () => {
        const { service, configs, portProbe } = makeFakes([{ id: "id-1", name: "plain", entry: "i.js", env: {} }])

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBeUndefined()
        expect(configs.get("id-1")?.env).toEqual({})
        expect(portProbe.isPortFree).not.toHaveBeenCalled()
    })

    it("gives two eligible Apps different ports", async () => {
        const { service, configs } = makeFakes([
            proxied(),
            proxied({ id: "id-2", name: "web", proxyHost: "w.example.com" }),
        ])

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBe(20000)
        expect(configs.get("id-2")?.port).toBe(20001)
    })

    it("skips a port another App has already claimed, in a field or an Env", async () => {
        const { service, configs } = makeFakes([
            proxied(),
            { id: "id-2", name: "a", entry: "i.js", env: {}, port: 20000 },
            { id: "id-3", name: "b", entry: "i.js", env: { PORT: "20001" } },
        ])

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBe(20002)
    })

    it("skips a port a foreign process is sitting on", async () => {
        const { service, configs } = makeFakes([proxied()], { busyPorts: [20000, 20001] })

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBe(20002)
    })

    it("never hands out the port the server itself listens on", async () => {
        const { service, configs } = makeFakes([proxied()])

        await service.reconcileFleet({ reservedPorts: [20000] })

        expect(configs.get("id-1")?.port).toBe(20001)
    })

    it("says so rather than starting the App when the range is exhausted", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
        const busyPorts = Array.from({ length: 1000 }, (_, i) => 20000 + i)
        const { service, configs } = makeFakes([proxied()], { busyPorts })

        await service.reconcileFleet()

        expect(configs.get("id-1")?.port).toBeUndefined()
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("no free port left"))
        warn.mockRestore()
    })

    it("assigns on a config save too, so a Proxy Host set in the UI works without a restart", async () => {
        const { service, configs } = makeFakes([{ id: "id-1", name: "api", entry: "i.js", env: {} }])

        await service.updateAppConfig("id-1", { proxyHost: "api.example.com" })

        expect(configs.get("id-1")?.port).toBe(20000)
    })

    it("restarts the App when a save assigns it a port, so it binds the new one", async () => {
        const { service, processManager } = makeFakes([{ id: "id-1", name: "api", entry: "i.js", env: {} }])

        await service.updateAppConfig("id-1", { proxyHost: "api.example.com" })

        expect(processManager.recreateAppProcess).toHaveBeenCalledWith(
            expect.objectContaining({ env: expect.objectContaining({ PORT: "20000" }) }),
        )
    })
})
