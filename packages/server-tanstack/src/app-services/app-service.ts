import { needsRecreate } from "@/domain/app-config-change.ts"
import { deriveAppState } from "@/domain/app-state.ts"
import { findOrphanProcessNames } from "@/domain/fleet.ts"
import type { AppConfig, AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { ArtifactStore } from "@/interface-services/artifact-store.ts"
import { type ProcessManager, toProcessSpec } from "@/interface-services/process-manager.ts"

export type AppMutationResult =
    | { ok: true; config: AppConfig }
    | { ok: false; code: "not-found" | "name-taken" | "invalid" }

export const createAppService = ({
    configRepository,
    processManager,
    artifactStore,
}: {
    configRepository: AppConfigRepository
    processManager: ProcessManager
    artifactStore: Pick<ArtifactStore, "getAppDir" | "deleteAppDir" | "hasArtifact">
}) => {
    const specFor = (config: AppConfig) => toProcessSpec(config, artifactStore.getAppDir(config.id))

    const nameTakenByOther = async (name: string | undefined, appId: string) => {
        if (!name) {
            return false
        }

        const existing = await configRepository.findAppConfigByName(name)
        return !!existing && existing.id !== appId
    }

    return {
        // Boot: recreate every configured app and reclaim labelled processes that
        // no longer have a config (ADR-0003). Recreate rather than restart, since
        // pm2 keeps the env a process was started with.
        async reconcileFleet() {
            const configs = await configRepository.listAppConfigs()

            const outcomes = await Promise.all(
                configs.map(config => processManager.recreateAppProcess(specFor(config))),
            )

            const runningFleet = await processManager.listFleetProcesses()
            const orphans = findOrphanProcessNames(
                configs.map(config => config.name),
                runningFleet.map(proc => proc.name),
            )

            for (const orphanName of orphans) {
                console.log(`Reclaiming '${orphanName}': labelled as ours but no config exists.`)
                await processManager.stopAppProcess(orphanName)
                await processManager.deleteAppProcess(orphanName)
            }

            const failures = configs
                .map((config, index) => ({ config, outcome: outcomes[index] }))
                .filter(({ outcome }) => !outcome?.ok)

            for (const { config, outcome } of failures) {
                console.warn(`Did not start '${config.name}': ${outcome?.ok === false ? outcome.reason : "unknown"}.`)
            }

            console.log(
                `Started ${outcomes.length - failures.length} of ${configs.length} apps` +
                    (orphans.length ? `, reclaimed ${orphans.length} orphan(s).` : "."),
            )
        },

        // Shutdown: take down our own apps and nothing else. The daemon and any
        // process we did not configure survive (ADR-0003).
        async stopFleet() {
            const configs = await configRepository.listAppConfigs()

            const outcomes = await Promise.all(configs.map(config => processManager.deleteAppProcess(config.name)))

            console.log(`Stopped ${outcomes.filter(outcome => outcome.ok).length} of ${configs.length} apps.`)
        },

        async listApps() {
            const configs = await configRepository.listAppConfigs()

            return Promise.all(
                configs.map(async config => {
                    const managed = await processManager.getAppProcess(config.name)

                    return {
                        config,
                        state: deriveAppState(managed?.status, await artifactStore.hasArtifact(config.id)),
                    }
                }),
            )
        },

        async createApp(appId: string, name?: string, env?: AppConfig["env"]): Promise<AppMutationResult> {
            const appName = name ?? appId

            if (await nameTakenByOther(appName, appId)) {
                return { ok: false, code: "name-taken" }
            }

            const config = await configRepository.createAppConfig(appId, appName, env)

            if (!config) {
                return { ok: false, code: "invalid" }
            }

            return { ok: true, config }
        },

        async updateAppConfig(appId: string, partial: Partial<AppConfig>): Promise<AppMutationResult> {
            const current = await configRepository.getAppConfig(appId)

            if (!current) {
                return { ok: false, code: "not-found" }
            }

            if (await nameTakenByOther(partial.name, appId)) {
                return { ok: false, code: "name-taken" }
            }

            const response = await configRepository.updateAppConfig(appId, partial)

            if (!response) {
                return { ok: false, code: "invalid" }
            }

            const [prevConfig, currConfig] = response

            if (!(await processManager.getAppProcess(prevConfig.name))) {
                return { ok: true, config: currConfig }
            }

            if (needsRecreate(prevConfig, currConfig)) {
                if (prevConfig.name !== currConfig.name) {
                    // Nothing stray: the old name would otherwise linger.
                    await processManager.stopAppProcess(prevConfig.name)
                    await processManager.deleteAppProcess(prevConfig.name)
                }

                await processManager.recreateAppProcess(specFor(currConfig))
            }

            return { ok: true, config: currConfig }
        },

        async deleteApp(appId: string): Promise<{ ok: true } | { ok: false; code: "not-found" }> {
            const config = await configRepository.getAppConfig(appId)

            if (!config) {
                return { ok: false, code: "not-found" }
            }

            await processManager.stopAppProcess(config.name)
            await processManager.deleteAppProcess(config.name)
            await configRepository.deleteAppConfig(appId)
            await artifactStore.deleteAppDir(appId)

            return { ok: true }
        },
    }
}

export type AppService = ReturnType<typeof createAppService>
