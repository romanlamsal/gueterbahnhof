import { ServerConfig } from "@gueterbahnhof/common/ServerConfig"
import { createCommand, Option, program } from "commander"
import { createMainServer } from "./createMainServer"
import "dotenv/config"

const createServerCommand = (version?: string) =>
    createCommand("server")
        .addOption(
            new Option("--app-dir <string>", "set app directory to use")
                .default(process.env.GUETERBAHNHOF_APP_DIR || undefined)
                .makeOptionMandatory(true),
        )
        .option("-p, --port <number>", "set server port", process.env.GUETERBAHNHOF_PORT || "4444")
        .option("--api-key <string>", "api key for the management api", process.env.GUETERBAHNHOF_API_KEY)
        .action(async (options: ServerConfig) => {
            if (version) {
                console.log("Starting server in version", version)
            }

            const mainServer = await createMainServer(options)

            mainServer.start()
        })

if (process.argv[2] === "dev") {
    process.argv[2] = "server"
    program.addCommand(createServerCommand()).parse()
}

export default createServerCommand
