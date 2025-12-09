import { type AppConfig, appConfigRepository } from "@/lib/app-config-repository.ts"
import { pm2Service } from "@/lib/pm-service.ts"

export const appService = {
    async startAllApps() {
        const configs = await appConfigRepository.listAppConfigs()

        const procs = await Promise.all(configs.map(config => pm2Service.startAppProcess(config)))

        console.log(`Started ${procs.filter(Boolean).length} of ${configs.length} apps.`)
    },

    async wipeAllApps() {
        const configs = await appConfigRepository.listAppConfigs()

        const procs = await Promise.all(
            configs.map(config => pm2Service.deleteAppProcess(config.name)),
        )

        console.log(`Stopped ${procs.filter(Boolean).length} of ${configs.length} apps.`)
    },

    async listApps() {
        const configs = await appConfigRepository.listAppConfigs()

        return Promise.all(
            configs.map(async config => ({
                config,
                status: await pm2Service
                    .getAppProcess(config.name)
                    .then(procDescription => procDescription?.pm2_env?.status ?? "unknown"),
            })),
        )
    },

    async createService(appId: string, name?: string, env?: AppConfig["env"]) {
        return appConfigRepository.createAppConfig(appId, name ?? appId, env)
    },

    async startOrReload(appId: string) {
        const config = await appConfigRepository.getAppConfig(appId)

        if (!config) {
            console.error(`Failed to start app with id '${appId}': no config.`)
            return
        }

        return pm2Service.startOrRestartAppProcess(config)
    },

    async updateAppConfig(appId: string, config: Partial<AppConfig>) {
        const response = await appConfigRepository.updateAppConfig(appId, config)

        if (!response) {
            return
        }

        const [prevConfig, currConfig] = response

        if (!(await pm2Service.getAppProcess(prevConfig.name))) {
            return currConfig
        }

        let shouldStart = false

        if (prevConfig.name !== currConfig.name || prevConfig.script !== currConfig.script) {
            await pm2Service.stopAppProcess(prevConfig.name)
            shouldStart = true
        }

        const envChanged = (() => {
            const prevEnvKeys = Object.keys(prevConfig.env)
            const currentEnvKeys = Object.keys(currConfig.env)

            if (prevEnvKeys.length !== currentEnvKeys.length) {
                return true
            } else if (
                prevEnvKeys.some(envKey => prevConfig.env[envKey] !== currConfig.env[envKey])
            ) {
                return true
            }

            return false
        })()

        if (envChanged) {
            await pm2Service.stopAppProcess(prevConfig.name)
            await pm2Service.deleteAppProcess(prevConfig.name)
            shouldStart = true
        }

        if (shouldStart) {
            await pm2Service.startAppProcess(currConfig)
        }

        return currConfig
    },
}

export type AppService = typeof appService
