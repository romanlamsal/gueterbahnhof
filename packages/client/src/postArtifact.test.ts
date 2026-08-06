import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { postArtifact, waitForDeployment } from "./postArtifact.js"

type SeenRequest = { method: string; url: string; authorization?: string; contentType?: string }

const startStubServer = (
    handler: (req: IncomingMessage, res: ServerResponse, seen: SeenRequest[]) => void,
): Promise<{ server: Server; host: string; seen: SeenRequest[] }> =>
    new Promise(resolve => {
        const seen: SeenRequest[] = []
        const server = createServer((req, res) => {
            seen.push({
                method: req.method ?? "",
                url: req.url ?? "",
                authorization: req.headers.authorization,
                contentType: req.headers["content-type"],
            })
            handler(req, res, seen)
        })
        server.listen(0, "127.0.0.1", () => {
            resolve({ server, host: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen })
        })
    })

describe("postArtifact", () => {
    let artifactDir: string
    let server: Server | undefined

    beforeEach(() => {
        artifactDir = mkdtempSync(join(tmpdir(), "gbhf-client-"))
        writeFileSync(join(artifactDir, "index.js"), "console.log('hi')")
    })

    afterEach(() => {
        rmSync(artifactDir, { recursive: true, force: true })
        server?.close()
        server = undefined
    })

    it("uploads the zipped directory and returns the deployment id from the 202", async () => {
        const stub = await startStubServer((req, res) => {
            req.resume()
            req.on("end", () => {
                res.writeHead(202, { "content-type": "application/json" })
                res.end(JSON.stringify({ deploymentId: "dep-42" }))
            })
        })
        server = stub.server

        const result = await postArtifact({ appName: "my-app", host: stub.host, apiKey: "key-1" }, artifactDir)

        expect(result.deploymentId).toBe("dep-42")
        expect(stub.seen[0]).toMatchObject({ method: "POST", url: "/update/my-app", authorization: "key-1" })
        expect(stub.seen[0]?.contentType).toContain("multipart/form-data")
    })

    it("tolerates a legacy empty-body response", async () => {
        const stub = await startStubServer((req, res) => {
            req.resume()
            req.on("end", () => {
                res.writeHead(200)
                res.end()
            })
        })
        server = stub.server

        const result = await postArtifact({ appName: "my-app", host: stub.host }, artifactDir)

        expect(result.deploymentId).toBeUndefined()
    })

    it("throws on a 4xx response", async () => {
        const stub = await startStubServer((req, res) => {
            req.resume()
            req.on("end", () => {
                res.writeHead(400, { "content-type": "application/json" })
                res.end(JSON.stringify({ error: "App 'my-app' not found." }))
            })
        })
        server = stub.server

        await expect(postArtifact({ appName: "my-app", host: stub.host }, artifactDir)).rejects.toThrow()
    })
})

describe("waitForDeployment", () => {
    let server: Server | undefined

    afterEach(() => {
        server?.close()
        server = undefined
    })

    const statusSequence = (states: { deploymentId: string; state: string; reason?: string }[]) => {
        let call = 0
        return startStubServer((_req, res) => {
            const status = states[Math.min(call, states.length - 1)]
            call++
            res.writeHead(200, { "content-type": "application/json" })
            res.end(JSON.stringify(status))
        })
    }

    it("polls until the deployment succeeds", async () => {
        const stub = await statusSequence([
            { deploymentId: "dep-1", state: "extracting" },
            { deploymentId: "dep-1", state: "starting" },
            { deploymentId: "dep-1", state: "succeeded" },
        ])
        server = stub.server

        const result = await waitForDeployment({ appName: "my-app", host: stub.host, apiKey: "key-1" }, "dep-1", {
            pollIntervalMs: 5,
            timeoutMs: 5_000,
        })

        expect(result.state).toBe("succeeded")
        expect(stub.seen.length).toBeGreaterThanOrEqual(3)
        expect(stub.seen[0]).toMatchObject({ url: "/update/my-app/status?deploymentId=dep-1", authorization: "key-1" })
    })

    it("reports failure with the reason", async () => {
        const stub = await statusSequence([
            { deploymentId: "dep-1", state: "extracting" },
            { deploymentId: "dep-1", state: "failed", reason: "The process failed to start." },
        ])
        server = stub.server

        const result = await waitForDeployment({ appName: "my-app", host: stub.host }, "dep-1", {
            pollIntervalMs: 5,
            timeoutMs: 5_000,
        })

        expect(result).toMatchObject({ state: "failed", reason: "The process failed to start." })
    })

    it("polls with its own deployment id", async () => {
        const stub = await statusSequence([{ deploymentId: "dep-1", state: "succeeded" }])
        server = stub.server

        await waitForDeployment({ appName: "my-app", host: stub.host }, "dep-1", {
            pollIntervalMs: 5,
            timeoutMs: 5_000,
        })

        expect(stub.seen[0]?.url).toBe("/update/my-app/status?deploymentId=dep-1")
    })

    it("reports 'superseded' when a server without id support answers with someone else's deployment", async () => {
        const stub = await statusSequence([{ deploymentId: "dep-other", state: "extracting" }])
        server = stub.server

        const result = await waitForDeployment({ appName: "my-app", host: stub.host }, "dep-1", {
            pollIntervalMs: 5,
            timeoutMs: 5_000,
        })

        expect(result.state).toBe("superseded")
    })

    it("reports 'superseded' when the record was evicted (404)", async () => {
        const stub = await startStubServer((_req, res) => {
            res.writeHead(404, { "content-type": "application/json" })
            res.end(JSON.stringify({ error: "No deployment found." }))
        })
        server = stub.server

        const result = await waitForDeployment({ appName: "my-app", host: stub.host }, "dep-1", {
            pollIntervalMs: 5,
            timeoutMs: 5_000,
        })

        expect(result.state).toBe("superseded")
    })

    it("times out when the deployment never terminates", async () => {
        const stub = await statusSequence([{ deploymentId: "dep-1", state: "starting" }])
        server = stub.server

        const result = await waitForDeployment({ appName: "my-app", host: stub.host }, "dep-1", {
            pollIntervalMs: 5,
            timeoutMs: 60,
        })

        expect(result.state).toBe("timeout")
    })
})
