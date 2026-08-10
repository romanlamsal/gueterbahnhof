import { changedFleetKeys, isReferenceableFleetKey, referencedFleetKeys } from "@/domain/fleet-env.ts"
import type { AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { FleetEnvRepository } from "@/interface-services/fleet-env-repository.ts"
import type { AppService } from "./app-service.ts"

export type FleetEnvSaveResult =
    | { ok: true }
    // Names no App could reference, so entries nothing could ever use.
    | { ok: false; code: "unreferenceable-key"; keys: string[] }
    // Removing a key Apps still name would break them at their next start,
    // which is exactly the silent failure this feature exists to avoid.
    | { ok: false; code: "still-referenced"; usage: { key: string; apps: string[] }[] }

export const createFleetEnvService = ({
    fleetEnvRepository,
    configRepository,
    appService,
}: {
    fleetEnvRepository: FleetEnvRepository
    configRepository: Pick<AppConfigRepository, "listAppConfigs">
    appService: Pick<AppService, "recreateAppsReferencing">
}) => ({
    getFleetEnv() {
        return fleetEnvRepository.readFleetEnv()
    },

    // The page edits the whole set, so a save is a replacement: what is absent
    // has been deleted, and the guards fall out of comparing the two.
    async saveFleetEnv(next: Record<string, string>): Promise<FleetEnvSaveResult> {
        const unreferenceable = Object.keys(next).filter(key => !isReferenceableFleetKey(key))

        if (unreferenceable.length > 0) {
            return { ok: false, code: "unreferenceable-key", keys: unreferenceable }
        }

        const previous = await fleetEnvRepository.readFleetEnv()
        const configs = await configRepository.listAppConfigs()

        const usage = Object.keys(previous)
            .filter(key => !(key in next))
            .map(key => ({
                key,
                apps: configs.filter(config => referencedFleetKeys(config.env).has(key)).map(config => config.name),
            }))
            .filter(entry => entry.apps.length > 0)

        if (usage.length > 0) {
            return { ok: false, code: "still-referenced", usage }
        }

        await fleetEnvRepository.writeFleetEnv(next)

        // Only what actually changed, and only the Apps that named it: rotating
        // one credential must not take the whole Fleet down.
        await appService.recreateAppsReferencing(changedFleetKeys(previous, next))

        return { ok: true }
    },
})

export type FleetEnvService = ReturnType<typeof createFleetEnvService>
