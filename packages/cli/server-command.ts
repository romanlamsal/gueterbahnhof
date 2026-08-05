import { existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { command } from "cleye"
import express from "express"

const createServerCommand = (version?: string) =>
    command(
        {
            name: "server",
            flags: {
                appDir: {
                    type: String,
                    description: "set app directory to use (env: GUETERBAHNHOF_APP_DIR)",
                    default: process.env.GUETERBAHNHOF_APP_DIR ?? "",
                },
                port: {
                    type: String,
                    alias: "p",
                    description: "set server port (env: GUETERBAHNHOF_PORT)",
                    default: process.env.GUETERBAHNHOF_PORT || "4444",
                },
                apiKey: {
                    type: String,
                    description: "api key for the management api (env: GUETERBAHNHOF_API_KEY)",
                    default: process.env.GUETERBAHNHOF_API_KEY ?? "",
                },
            },
            help: {
                description: "Start the gueterbahnhof server.",
            },
        },
        async argv => {
            const { appDir, port, apiKey } = argv.flags

            if (!appDir) {
                console.error("Missing required flag: --app-dir (or GUETERBAHNHOF_APP_DIR).")
                process.exitCode = 1
                return
            }

            if (version) {
                console.log("Starting server in version", version)
            }

            // The built tanstack server reads its config from env.
            process.env.GUETERBAHNHOF_DIR = appDir
            if (apiKey) {
                process.env.GUETERBAHNHOF_API_KEY = apiKey
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

            app.listen(Number.parseInt(port, 10), () => {
                console.log(`Started gueterbahnhof on http://localhost:${port}.`)
            })
        },
    )

export default createServerCommand
