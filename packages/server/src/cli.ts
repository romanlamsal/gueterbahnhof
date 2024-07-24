import { ServerConfig } from "@gueterbahnhof/common/ServerConfig"
import { createCommand, program } from "commander"
import { createMainServer } from "./createMainServer"

const createServerCommand = (version?: string) =>
    createCommand("server")
        .requiredOption("--app-dir <string>", "set app directory to use")
        .option("-p, --port <number>", "set server port")
        .option("--api-key <string>", "api key for the management api")
        .action(async (options: ServerConfig) => {
            if (version) {
                console.log("Starting server in version", version)
            }

            if (!options.port) {
                options.port = 4444
            }

            const mainServer = await createMainServer(options)

            mainServer.start()
        })

if (process.argv[2] === "dev") {
    process.argv[2] = "server"
    program.addCommand(createServerCommand()).parse()
}

export default createServerCommand
