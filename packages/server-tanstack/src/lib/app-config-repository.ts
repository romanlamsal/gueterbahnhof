import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { parse } from "dotenv"
import { z } from "zod"
import { $env } from "@/lib/$env.ts"

export const AppConfigSchema = z.object({
    id: z.string(),
    name: z.string(),
    script: z.string().optional(),
    env: z.record(z.string(), z.string()).default({}),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

export const appConfigRepository = {
    getConfigPath(appId: string) {
        return join($env.GUETERBAHNHOF_DIR, "apps", `${appId}.json`)
    },

    async createAppConfig(appId: string, name: string, env?: AppConfig["env"]) {
        const currConfig = await this.getAppConfig(appId)

        if (currConfig) {
            console.error("Config already exists, abort.")
            return
        }

        const newConfig = AppConfigSchema.parse({ id: appId, name, env } satisfies z.input<
            typeof AppConfigSchema
        >)

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

        const envFilePath = join(dirname(configPath), `${appId}.env`)
        if (existsSync(envFilePath)) {
            console.debug("Reading and appending env file.")
            validation.data.env = {
                ...(validation.data.env ?? {}),
                ...parse(readFileSync(envFilePath, "utf-8")),
            }
        }

        return validation.data
    },

    async updateAppConfig(
        appId: string,
        appConfig: Partial<AppConfig>,
    ): Promise<[AppConfig, AppConfig] | void> {
        const currentConfig = await this.getAppConfig(appId)

        if (!currentConfig) {
            console.error("Cannot update app config: does not exist.")
            return
        }

        const validation = AppConfigSchema.safeParse({ ...currentConfig, ...appConfig })

        if (!validation.data) {
            console.error("Cannot update app config: Parse error:", validation.error)
            return
        }

        writeFileSync(this.getConfigPath(appId), JSON.stringify(validation.data, null, 2))

        return [currentConfig, validation.data] as const
    },

    async listAppConfigs() {
        const appsConfigDir = dirname(this.getConfigPath("whocares"))

        const configFiles = await readdir(appsConfigDir)

        return Promise.all(
            configFiles
                .filter(fileName => fileName.endsWith(".json"))
                .map(fileName => {
                    return this.getAppConfig(fileName.replace(".json", ""))
                }),
        ).then(appConfigs => appConfigs.filter(appConfig => !!appConfig))
    },
}
