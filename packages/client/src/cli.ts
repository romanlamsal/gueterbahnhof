import { createCommand, program } from "commander"
import { postArtifact, PostArtifactArgs } from "./postArtifact"

const clientCommand = createCommand("deploy")
    .requiredOption("-n, --app-name <string>", "name of the app to update")
    .requiredOption("--host <string>", "protocol + hostname + port of the gueterbahnhof server")
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
