import { describe, expect, it, vi } from "vitest"
import type { AppConfig } from "@/interface-services/app-config-repository.ts"
import { createFleetEnvService } from "./fleet-env-service.ts"

const makeFakes = (fleetEnv: Record<string, string> = {}, appConfigs: AppConfig[] = []) => {
    let stored = { ...fleetEnv }

    const fleetEnvRepository = {
        readFleetEnv: vi.fn(async () => ({ ...stored })),
        writeFleetEnv: vi.fn(async (values: Record<string, string>) => {
            stored = { ...values }
        }),
    }

    const configRepository = { listAppConfigs: vi.fn(async () => appConfigs) }
    const appService = { recreateAppsReferencing: vi.fn(async () => undefined) }

    return {
        service: createFleetEnvService({ fleetEnvRepository, configRepository, appService }),
        fleetEnvRepository,
        appService,
        stored: () => stored,
    }
}

const app = (name: string, env: Record<string, string>): AppConfig => ({ id: name, name, entry: "i.js", env })

describe("fleetEnvService.saveFleetEnv", () => {
    it("writes the values", async () => {
        const { service, stored } = makeFakes({ a: "1" })

        await expect(service.saveFleetEnv({ a: "2", b: "3" })).resolves.toEqual({ ok: true })
        expect(stored()).toEqual({ a: "2", b: "3" })
    })

    it("restarts only the Apps referencing a key that changed", async () => {
        const { service, appService } = makeFakes({ a: "1", b: "1" }, [
            app("uses-a", { X: "$fleet.a" }),
            app("uses-b", { X: "$fleet.b" }),
            app("uses-nothing", { X: "plain" }),
        ])

        await service.saveFleetEnv({ a: "changed", b: "1" })

        // Rotating one credential must not take the whole fleet down.
        expect(appService.recreateAppsReferencing).toHaveBeenCalledWith(new Set(["a"]))
    })

    it("counts an added key as changed, so an App broken by a missing key recovers", async () => {
        const { service, appService } = makeFakes({}, [app("waiting", { X: "$fleet.later" })])

        await service.saveFleetEnv({ later: "now here" })

        expect(appService.recreateAppsReferencing).toHaveBeenCalledWith(new Set(["later"]))
    })

    it("restarts nothing when nothing changed", async () => {
        const { service, appService } = makeFakes({ a: "1" }, [app("uses-a", { X: "$fleet.a" })])

        await service.saveFleetEnv({ a: "1" })

        expect(appService.recreateAppsReferencing).toHaveBeenCalledWith(new Set())
    })

    it("refuses to remove a key Apps still reference, naming them", async () => {
        const { service } = makeFakes({ a: "1" }, [
            app("scrumpoker", { X: "$fleet.a" }),
            app("pollen", { Y: "$fleet.a" }),
        ])

        const result = await service.saveFleetEnv({})

        expect(result).toEqual({
            ok: false,
            code: "still-referenced",
            usage: [{ key: "a", apps: ["scrumpoker", "pollen"] }],
        })
    })

    it("writes nothing and restarts nothing when it refuses a removal", async () => {
        const { service, fleetEnvRepository, appService, stored } = makeFakes({ a: "1" }, [
            app("uses-a", { X: "$fleet.a" }),
        ])

        await service.saveFleetEnv({})

        expect(fleetEnvRepository.writeFleetEnv).not.toHaveBeenCalled()
        expect(appService.recreateAppsReferencing).not.toHaveBeenCalled()
        expect(stored()).toEqual({ a: "1" })
    })

    it("allows removing a key nothing references", async () => {
        const { service, stored } = makeFakes({ a: "1", unused: "2" }, [app("uses-a", { X: "$fleet.a" })])

        await expect(service.saveFleetEnv({ a: "1" })).resolves.toEqual({ ok: true })
        expect(stored()).toEqual({ a: "1" })
    })

    it("refuses a key name no App could ever reference", async () => {
        const { service, fleetEnvRepository } = makeFakes()

        const result = await service.saveFleetEnv({ "supabase-url": "x", ok_name: "y" })

        expect(result).toEqual({ ok: false, code: "unreferenceable-key", keys: ["supabase-url"] })
        expect(fleetEnvRepository.writeFleetEnv).not.toHaveBeenCalled()
    })
})

describe("fleetEnvService.getFleetEnv", () => {
    it("returns what is stored", async () => {
        const { service } = makeFakes({ a: "1" })

        await expect(service.getFleetEnv()).resolves.toEqual({ a: "1" })
    })
})
