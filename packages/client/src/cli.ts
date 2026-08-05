import { cli, command } from "cleye"
import { postArtifact, waitForDeployment } from "./postArtifact.js"

const envWaitDefault = ["1", "true", "yes"].includes((process.env.GUETERBAHNHOF_WAIT ?? "").toLowerCase())

export const deployCommand = command(
    {
        name: "deploy",
        parameters: ["<directory>"],
        flags: {
            appName: {
                type: String,
                alias: "n",
                description: "name of the app to update (env: GUETERBAHNHOF_APP_NAME)",
                default: process.env.GUETERBAHNHOF_APP_NAME ?? "",
            },
            host: {
                type: String,
                description: "protocol + hostname + port of the gueterbahnhof server (env: GUETERBAHNHOF_HOST)",
                default: process.env.GUETERBAHNHOF_HOST ?? "",
            },
            apiKey: {
                type: String,
                description: "api key for the server's management api (env: GUETERBAHNHOF_API_KEY)",
                default: process.env.GUETERBAHNHOF_API_KEY ?? "",
            },
            wait: {
                type: Boolean,
                description: "poll the deployment status until it succeeds or fails (env: GUETERBAHNHOF_WAIT)",
                default: envWaitDefault,
            },
        },
        help: {
            description: "Zip a directory and deploy it as an artifact to a gueterbahnhof server.",
        },
    },
    async argv => {
        const { appName, host, apiKey, wait } = argv.flags

        if (!appName || !host) {
            console.error(
                "Missing required flags: --app-name and --host (or GUETERBAHNHOF_APP_NAME / GUETERBAHNHOF_HOST).",
            )
            process.exitCode = 1
            return
        }

        const target = { appName, host, apiKey: apiKey || undefined }

        let deploymentId: string | undefined

        try {
            deploymentId = (await postArtifact(target, argv._.directory)).deploymentId
            console.log(deploymentId ? `Deployment accepted: ${deploymentId}` : "Deployment accepted.")
        } catch (err) {
            const error = err as { code?: string; name?: string; message?: string }
            console.error("ERROR:", error.code ?? error.name, error.message ?? "")
            process.exitCode = 1
            return
        }

        if (!wait) {
            return
        }

        const outcome = await waitForDeployment(target, deploymentId)

        if (outcome.state === "succeeded") {
            console.log("Succesfully deployed.")
            return
        }

        console.error(`Deployment did not succeed: ${outcome.state}${outcome.reason ? ` (${outcome.reason})` : ""}`)
        process.exitCode = 1
    },
)

if (process.argv[2] === "dev") {
    process.argv[2] = "deploy"
    cli({ name: "gueterbahnhof", commands: [deployCommand] })
}

export default deployCommand
