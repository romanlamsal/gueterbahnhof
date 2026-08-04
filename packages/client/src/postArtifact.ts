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

    // Poll by our own deployment id so a later deploy cannot shadow the
    // outcome; the server keeps recent records per app.
    const statusUrl = `${host}/update/${appName}/status${deploymentId ? `?deploymentId=${deploymentId}` : ""}`

    while (Date.now() < deadline) {
        const response = await got(statusUrl, {
            headers: { authorization: apiKey },
            throwHttpErrors: false,
        }).catch(() => undefined)

        // 404 with an id means our record was evicted by newer deployments —
        // the outcome is unknowable, report it distinctly.
        if (response?.statusCode === 404 && deploymentId) {
            return { state: "superseded" }
        }

        if (response?.statusCode === 200) {
            const status = (() => {
                try {
                    return JSON.parse(response.body) as { deploymentId: string; state: string; reason?: string }
                } catch {
                    return undefined
                }
            })()

            if (status) {
                // A server that ignores the id param (or a legacy one) may
                // answer with someone else's deployment.
                if (deploymentId && status.deploymentId !== deploymentId) {
                    return { state: "superseded" }
                }

                if (status.state === "succeeded" || status.state === "failed") {
                    return { state: status.state, reason: status.reason }
                }
            }
        }

        await sleep(pollIntervalMs)
    }

    return { state: "timeout" }
}
