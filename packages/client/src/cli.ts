import { createCommand } from "commander"
import { postArtifact, PostArtifactArgs } from "./postArtifact"

export default createCommand("deploy")
    .requiredOption("-n, --app-name <string>", "name of the app to update")
    .requiredOption("--host <string>", "protocol + hostname + port of the gueterbahnhof server")
    .option("--api-key <string>", "api key for the server's management api")
    .argument("<string>", "directory to deploy")
    .action(async (directoryPath: string, options: PostArtifactArgs) => {
        console.log(`Updating app ${options.appName}.`, options)
        await postArtifact(options, directoryPath)
    })
