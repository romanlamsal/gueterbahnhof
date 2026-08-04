import { createCommand, Option, program } from "commander"
import type { PostArtifactArgs } from "./postArtifact.js"
import { postArtifact, waitForDeployment } from "./postArtifact.js"

const envWaitDefault = ["1", "true", "yes"].includes((process.env.GUETERBAHNHOF_WAIT ?? "").toLowerCase())

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
    .option("--api-key <string>", "api key for the server's management api", process.env.GUETERBAHNHOF_API_KEY)
    .option("--wait", "poll the deployment status until it succeeds or fails", envWaitDefault)
    .argument("<string>", "directory to deploy")
    .action(async (directoryPath: string, options: PostArtifactArgs) => {
        let deploymentId: string | undefined

        try {
            deploymentId = (await postArtifact(options, directoryPath)).deploymentId
            console.log(deploymentId ? `Deployment accepted: ${deploymentId}` : "Deployment accepted.")
        } catch (err) {
            const error = err as { code?: string; name?: string; message?: string }
            console.error("ERROR:", error.code ?? error.name, error.message ?? "")
            process.exitCode = 1
            return
        }

        if (!options.wait) {
            return
        }

        const outcome = await waitForDeployment(options, deploymentId)

        if (outcome.state === "succeeded") {
            console.log("Succesfully deployed.")
            return
        }

        console.error(`Deployment did not succeed: ${outcome.state}${outcome.reason ? ` (${outcome.reason})` : ""}`)
        process.exitCode = 1
    })

if (process.argv[2] === "dev") {
    process.argv[2] = "deploy"
    program.addCommand(clientCommand).parse()
}
export default clientCommand
