import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { parse } from "dotenv"
import { z } from "zod"

export const AppConfigSchema = z.object({
    id: z.string(),
    name: z.string(),
    entry: z.string().optional(),
    env: z.record(z.string(), z.string()).default({}),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

export const createAppConfigRepository = (appsDir: string) => ({
    getConfigPath(appId: string) {
        return join(appsDir, `${appId}.json`)
    },

    async createAppConfig(appId: string, name: string, env?: AppConfig["env"]) {
        const currConfig = await this.getAppConfig(appId)

        if (currConfig) {
            console.error("Config already exists, abort.")
            return
        }

        const newConfig = AppConfigSchema.parse({ id: appId, name, env } satisfies z.input<typeof AppConfigSchema>)

        writeFileSync(this.getConfigPath(appId), JSON.stringify(newConfig, null, 2))

        return newConfig
    },

    async getAppConfig(appId: string) {
        const configPath = this.getConfigPath(appId)
        const configExists = existsSync(configPath)

        if (!configExists) {
            return
        }

        const validation = AppConfigSchema.safeParse(JSON.parse(await readFile(configPath, "utf8")))

        if (!validation.success) {
            console.error("Invalid config:", validation.error)
            return
        }

        const envFilePath = join(appsDir, `${appId}.env`)
        if (existsSync(envFilePath)) {
            validation.data.env = {
                ...(validation.data.env ?? {}),
                ...parse(readFileSync(envFilePath, "utf-8")),
            }
        }

        return validation.data
    },

    async updateAppConfig(appId: string, appConfig: Partial<AppConfig>): Promise<[AppConfig, AppConfig] | void> {
        const currentConfig = await this.getAppConfig(appId)

        if (!currentConfig) {
            console.error("Cannot update app config: does not exist.")
            return
        }

        const validation = AppConfigSchema.safeParse({ ...currentConfig, ...appConfig })

        if (!validation.success) {
            console.error("Cannot update app config: Parse error:", validation.error)
            return
        }

        writeFileSync(this.getConfigPath(appId), JSON.stringify(validation.data, null, 2))

        return [currentConfig, validation.data] as const
    },

    async findAppConfigByName(name: string) {
        const configs = await this.listAppConfigs()
        return configs.find(config => config.name === name)
    },

    async listAppConfigs() {
        const configFiles = await readdir(appsDir)

        return Promise.all(
            configFiles
                .filter(fileName => fileName.endsWith(".json"))
                .map(fileName => {
                    return this.getAppConfig(fileName.replace(".json", ""))
                }),
        ).then(appConfigs => appConfigs.filter(appConfig => !!appConfig))
    },
})

export type AppConfigRepository = ReturnType<typeof createAppConfigRepository>
