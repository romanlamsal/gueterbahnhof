import { existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { command } from "cleye"
import express from "express"
import { bootFleet, shutdownFleet } from "server-tanstack/src/runtime/lifecycle.ts"

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
                config: {
                    type: String,
                    description: "path to the config file (default: ~/.gueterbahnhof); read before flags are resolved",
                    default: "",
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

            // The built server reads its config from env. PM2_HOME is deliberately
            // left untouched: if the operator set it, both our client and the
            // daemon we spawn inherit it (ADR-0003).
            process.env.GUETERBAHNHOF_DIR = appDir
            if (apiKey) {
                process.env.GUETERBAHNHOF_API_KEY = apiKey
            }

            const serverOutputDir = join(fileURLToPath(new URL(".", import.meta.url)), "server-output")

            if (!existsSync(serverOutputDir)) {
                console.error(`Server bundle not found at '${serverOutputDir}'. This is a packaging error.`)
                process.exit(1)
            }

            // Boot the fleet before serving: connect the daemon, migrate a legacy
            // config, then recreate every configured app. Failing here must be
            // loud and fatal — a listening server with no apps is worse.
            try {
                await bootFleet(appDir)
            } catch (error) {
                console.error("Boot failed:", error)
                process.exit(1)
            }

            // Our apps go down with us, but the daemon and anything we did not
            // configure stay up (ADR-0003).
            let shuttingDown = false
            for (const signal of ["SIGTERM", "SIGINT"] as const) {
                process.on(signal, () => {
                    if (shuttingDown) {
                        return
                    }
                    shuttingDown = true

                    console.log(`Received ${signal}, stopping the fleet.`)

                    shutdownFleet(appDir)
                        .catch(error => console.error("Failed to stop the fleet:", error))
                        .then(() => process.exit(0))
                })
            }

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
