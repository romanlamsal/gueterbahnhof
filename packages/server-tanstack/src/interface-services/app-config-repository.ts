import { readdir, readFile, rm, writeFile } from "node:fs/promises"
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

const readFileOrUndefined = (filePath: string) => readFile(filePath, "utf8").catch(() => undefined)

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

        await writeFile(this.getConfigPath(appId), JSON.stringify(newConfig, null, 2))

        return newConfig
    },

    async getAppConfig(appId: string) {
        const raw = await readFileOrUndefined(this.getConfigPath(appId))

        if (raw === undefined) {
            return
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(raw)
        } catch (error) {
            console.error("Invalid config (not JSON):", error)
            return
        }

        const validation = AppConfigSchema.safeParse(parsed)

        if (!validation.success) {
            console.error("Invalid config:", validation.error)
            return
        }

        const envFileContent = await readFileOrUndefined(join(appsDir, `${appId}.env`))
        if (envFileContent !== undefined) {
            validation.data.env = {
                ...(validation.data.env ?? {}),
                ...parse(envFileContent),
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

        await writeFile(this.getConfigPath(appId), JSON.stringify(validation.data, null, 2))

        return [currentConfig, validation.data] as const
    },

    async deleteAppConfig(appId: string) {
        await rm(this.getConfigPath(appId), { force: true })
        await rm(join(appsDir, `${appId}.env`), { force: true })
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
