import { readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parse } from "dotenv"
import { z } from "zod"
import { MAX_PORT, MIN_PORT } from "@/domain/app-port.ts"

export const AppConfigSchema = z.object({
    id: z.string(),
    name: z.string(),
    entry: z.string().optional(),
    // Optional so every App Config already on disk parses unchanged: an App
    // with only a PORT in its Env resolves to that, and nothing migrates.
    port: z.number().int().min(MIN_PORT).max(MAX_PORT).optional(),
    // The public hostname this App answers on. Declaring one is the entire
    // opt-in to being proxied; no config on disk has one.
    proxyHost: z.string().optional(),
    env: z.record(z.string(), z.string()).default({}),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

// The port, written by hand from what callers use. Where each App Config file
// lives is the implementation's business, so it is not on here.
export type AppConfigRepository = {
    createAppConfig(appId: string, name: string, env?: AppConfig["env"]): Promise<AppConfig | undefined>
    getAppConfig(appId: string): Promise<AppConfig | undefined>
    updateAppConfig(appId: string, appConfig: Partial<AppConfig>): Promise<[AppConfig, AppConfig] | undefined>
    deleteAppConfig(appId: string): Promise<void>
    findAppConfigByName(name: string): Promise<AppConfig | undefined>
    listAppConfigs(): Promise<AppConfig[]>
}

const readFileOrUndefined = (filePath: string) => readFile(filePath, "utf8").catch(() => undefined)

export const createAppConfigRepository = (appsDir: string): AppConfigRepository => {
    const configPath = (appId: string) => join(appsDir, `${appId}.json`)
    const envSidecarPath = (appId: string) => join(appsDir, `${appId}.env`)

    const repository: AppConfigRepository = {
        async createAppConfig(appId, name, env) {
            const currConfig = await repository.getAppConfig(appId)

            if (currConfig) {
                console.error("Config already exists, abort.")
                return
            }

            const newConfig = AppConfigSchema.parse({ id: appId, name, env } satisfies z.input<typeof AppConfigSchema>)

            await writeFile(configPath(appId), JSON.stringify(newConfig, null, 2))

            return newConfig
        },

        async getAppConfig(appId) {
            const raw = await readFileOrUndefined(configPath(appId))

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

            const envFileContent = await readFileOrUndefined(envSidecarPath(appId))
            if (envFileContent !== undefined) {
                validation.data.env = {
                    ...(validation.data.env ?? {}),
                    ...parse(envFileContent),
                }
            }

            return validation.data
        },

        async updateAppConfig(appId, appConfig) {
            const currentConfig = await repository.getAppConfig(appId)

            if (!currentConfig) {
                console.error("Cannot update app config: does not exist.")
                return
            }

            const validation = AppConfigSchema.safeParse({ ...currentConfig, ...appConfig })

            if (!validation.success) {
                console.error("Cannot update app config: Parse error:", validation.error)
                return
            }

            await writeFile(configPath(appId), JSON.stringify(validation.data, null, 2))

            return [currentConfig, validation.data]
        },

        async deleteAppConfig(appId) {
            await rm(configPath(appId), { force: true })
            await rm(envSidecarPath(appId), { force: true })
        },

        async findAppConfigByName(name) {
            const configs = await repository.listAppConfigs()
            return configs.find(config => config.name === name)
        },

        async listAppConfigs() {
            const configFiles = await readdir(appsDir)

            return Promise.all(
                configFiles
                    .filter(fileName => fileName.endsWith(".json"))
                    .map(fileName => repository.getAppConfig(fileName.replace(".json", ""))),
            ).then(appConfigs => appConfigs.filter(appConfig => !!appConfig))
        },
    }

    return repository
}
