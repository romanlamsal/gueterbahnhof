import type { AppConfig, AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { AppProcessSpec, ProcessManager } from "@/interface-services/pm-service.ts"

const toProcessSpec = (config: AppConfig): AppProcessSpec => ({
    name: config.name,
    entry: config.entry,
    env: config.env,
})

export const createAppService = ({
    configRepository,
    processManager,
}: {
    configRepository: AppConfigRepository
    processManager: ProcessManager
}) => ({
    async startAllApps() {
        const configs = await configRepository.listAppConfigs()

        const procs = await Promise.all(configs.map(config => processManager.startAppProcess(toProcessSpec(config))))

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
            configs.map(async config => ({
                config,
                status: await processManager
                    .getAppProcess(config.name)
                    .then(procDescription => procDescription?.pm2_env?.status ?? "unknown"),
            })),
        )
    },

    async createApp(appId: string, name?: string, env?: AppConfig["env"]) {
        return configRepository.createAppConfig(appId, name ?? appId, env)
    },

    async startOrReload(appId: string) {
        const config = await configRepository.getAppConfig(appId)

        if (!config) {
            console.error(`Failed to start app with id '${appId}': no config.`)
            return
        }

        return processManager.startOrRestartAppProcess(toProcessSpec(config))
    },

    async updateAppConfig(appId: string, config: Partial<AppConfig>) {
        const response = await configRepository.updateAppConfig(appId, config)

        if (!response) {
            return
        }

        const [prevConfig, currConfig] = response

        if (!(await processManager.getAppProcess(prevConfig.name))) {
            return currConfig
        }

        let shouldStart = false

        if (prevConfig.name !== currConfig.name || prevConfig.entry !== currConfig.entry) {
            await processManager.stopAppProcess(prevConfig.name)
            shouldStart = true
        }

        const envChanged = (() => {
            const prevEnvKeys = Object.keys(prevConfig.env)
            const currentEnvKeys = Object.keys(currConfig.env)

            if (prevEnvKeys.length !== currentEnvKeys.length) {
                return true
            } else if (prevEnvKeys.some(envKey => prevConfig.env[envKey] !== currConfig.env[envKey])) {
                return true
            }

            return false
        })()

        if (envChanged) {
            await processManager.stopAppProcess(prevConfig.name)
            await processManager.deleteAppProcess(prevConfig.name)
            shouldStart = true
        }

        if (shouldStart) {
            await processManager.startAppProcess(toProcessSpec(currConfig))
        }

        return currConfig
    },
})

export type AppService = ReturnType<typeof createAppService>
