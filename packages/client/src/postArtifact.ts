import { setTimeout as sleep } from "node:timers/promises"
import AdmZip from "adm-zip"
import { Blob, FormData } from "formdata-node"
import got from "got"

export type DeployTarget = { appName: string; host: string; apiKey?: string }

export type PostArtifactArgs = DeployTarget & { wait?: boolean }

export async function postArtifact(
    { appName, host, apiKey }: DeployTarget,
    directoryPath: string,
): Promise<{ deploymentId?: string }> {
    const zip = new AdmZip()
    zip.addLocalFolder(directoryPath)

    const formData = new FormData()
    formData.set("artifact", new Blob([zip.toBuffer()]), "artifact.zip")

    const response = await got(`${host}/update/${appName}`, {
        method: "POST",
        body: formData,
        headers: {
            authorization: apiKey,
        },
    })

    // The server responds 202 + { deploymentId } (ADR-0001); a legacy server
    // responds with an empty body — tolerate it.
    try {
        return JSON.parse(response.body) as { deploymentId?: string }
    } catch {
        return {}
    }
}

export type DeploymentOutcome = {
    state: "succeeded" | "failed" | "superseded" | "timeout"
    reason?: string
}

export async function waitForDeployment(
    { appName, host, apiKey }: DeployTarget,
    deploymentId: string | undefined,
    { timeoutMs = 5 * 60_000, pollIntervalMs = 2_000 }: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<DeploymentOutcome> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        const status = await got(`${host}/update/${appName}/status`, {
            headers: { authorization: apiKey },
        })
            .json<{ deploymentId: string; state: string; reason?: string }>()
            .catch(() => undefined)

        if (status) {
            // At most one deployment is in flight per app, so a different id
            // means ours has been superseded by a later deploy.
            if (deploymentId && status.deploymentId !== deploymentId) {
                return { state: "superseded" }
            }

            if (status.state === "succeeded" || status.state === "failed") {
                return { state: status.state, reason: status.reason }
            }
        }

        await sleep(pollIntervalMs)
    }

    return { state: "timeout" }
}
