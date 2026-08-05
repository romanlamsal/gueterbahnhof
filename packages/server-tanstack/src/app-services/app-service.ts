import { decideRestart } from "@/domain/app-config-change.ts"
import { deriveAppState } from "@/domain/app-state.ts"
import type { AppConfig, AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { ArtifactStore } from "@/interface-services/artifact-store.ts"
import { type ProcessManager, toProcessSpec } from "@/interface-services/pm-service.ts"

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
        async startAllApps() {
            const configs = await configRepository.listAppConfigs()

            const procs = await Promise.all(
                configs.map(config => processManager.startAppProcess(specFor(config))),
            )

            console.log(`Started ${procs.filter(Boolean).length} of ${configs.length} apps.`)
        },

        async wipeAllApps() {
            const configs = await configRepository.listAppConfigs()

            const procs = await Promise.all(configs.map(config => processManager.deleteAppProcess(config.name)))

            console.log(`Stopped ${procs.filter(Boolean).length} of ${configs.length} apps.`)
        },

        async listApps() {
            const configs = await configRepository.listAppConfigs()

            return Promise.all(
                configs.map(async config => {
                    const processStatus = await processManager
                        .getAppProcess(config.name)
                        .then(procDescription => procDescription?.pm2_env?.status)

                    return {
                        config,
                        state: deriveAppState(processStatus, await artifactStore.hasArtifact(config.id)),
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

        async startOrReload(appId: string) {
            const config = await configRepository.getAppConfig(appId)

            if (!config) {
                console.error(`Failed to start app with id '${appId}': no config.`)
                return
            }

            return processManager.startOrRestartAppProcess(specFor(config))
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

            const decision = decideRestart(prevConfig, currConfig)

            if (decision === "restart") {
                await processManager.stopAppProcess(prevConfig.name)

                // A rename leaves the old-named pm2 entry behind forever —
                // delete it, nothing stray (ADR-0002 spirit).
                if (prevConfig.name !== currConfig.name) {
                    await processManager.deleteAppProcess(prevConfig.name)
                }
            } else if (decision === "recreate") {
                await processManager.stopAppProcess(prevConfig.name)
                await processManager.deleteAppProcess(prevConfig.name)
            }

            if (decision !== "none") {
                await processManager.startAppProcess(specFor(currConfig))
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
