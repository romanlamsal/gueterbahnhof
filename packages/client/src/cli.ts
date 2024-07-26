import { createCommand, Option, program } from "commander"
import type { PostArtifactArgs } from "./postArtifact"
import { postArtifact } from "./postArtifact"

const clientCommand = createCommand("deploy")
    .addOption(
        new Option("-n, --app-name <string>", "name of the app to update")
            .default(process.env.GUETERBAHNHOF_APP_NAME)
            .makeOptionMandatory(true),
    )
    .addOption(
        new Option("--host <string>", "protocol + hostname + port of the gueterbahnhof server")
            .default(process.env.GUETERBAHNHOF_HOST)
            .makeOptionMandatory(true),
    )
    .option("--api-key <string>", "api key for the server's management api")
    .argument("<string>", "directory to deploy")
    .action(async (directoryPath: string, options: PostArtifactArgs) => {
        await postArtifact(options, directoryPath)
    })

if (process.argv[2] === "dev") {
    process.argv[2] = "deploy"
    program.addCommand(clientCommand).parse()
}
export default clientCommand
