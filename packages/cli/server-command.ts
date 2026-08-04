import { existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { createCommand, Option } from "commander"
import express from "express"

type ServerOptions = {
    appDir: string
    port: string
    apiKey?: string
}

const createServerCommand = (version?: string) =>
    createCommand("server")
        .addOption(
            new Option("--app-dir <string>", "set app directory to use")
                .default(process.env.GUETERBAHNHOF_APP_DIR || undefined)
                .makeOptionMandatory(true),
        )
        .option("-p, --port <number>", "set server port", process.env.GUETERBAHNHOF_PORT || "4444")
        .option("--api-key <string>", "api key for the management api", process.env.GUETERBAHNHOF_API_KEY)
        .action(async (options: ServerOptions) => {
            if (version) {
                console.log("Starting server in version", version)
            }

            // The built tanstack server reads its config from env.
            process.env.GUETERBAHNHOF_DIR = options.appDir
            if (options.apiKey) {
                process.env.GUETERBAHNHOF_API_KEY = options.apiKey
            }

            const serverOutputDir = join(fileURLToPath(new URL(".", import.meta.url)), "server-output")

            if (!existsSync(serverOutputDir)) {
                console.error(`Server bundle not found at '${serverOutputDir}'. This is a packaging error.`)
                process.exit(1)
            }

            // Importing the nitro bundle boots the server: pm2 connect, legacy
            // config migration, starting all apps.
            const { middleware } = await import(join(serverOutputDir, "server/index.mjs"))

            const app = express()
            app.use(express.static(join(serverOutputDir, "public")))
            app.use(middleware)

            app.listen(Number.parseInt(options.port, 10), () => {
                console.log(`Started gueterbahnhof on http://localhost:${options.port}.`)
            })
        })

export default createServerCommand
