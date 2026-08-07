import { existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { command } from "cleye"
import { startGueterbahnhofServer } from "server-tanstack/src/stationmaster/start-server.ts"

// Argv and nothing else (ADR-0006): this resolves flags and the one fact only
// the CLI knows — where its own bundled server output sits — then hands over
// to the Stationmaster, which owns everything from there to serving.
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

            const serverOutputDir = join(fileURLToPath(new URL(".", import.meta.url)), "server-output")

            if (!existsSync(serverOutputDir)) {
                console.error(`Server bundle not found at '${serverOutputDir}'. This is a packaging error.`)
                process.exit(1)
            }

            try {
                await startGueterbahnhofServer({
                    appDir,
                    port: Number.parseInt(port, 10),
                    apiKey,
                    serverOutputDir,
                })
            } catch {
                // The Stationmaster has already said what went wrong; the exit
                // code is ours to set.
                process.exit(1)
            }
        },
    )

export default createServerCommand
