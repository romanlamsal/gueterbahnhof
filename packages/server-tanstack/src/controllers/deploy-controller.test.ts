import { existsSync, readFileSync, rmSync } from "node:fs"
import AdmZip from "adm-zip"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { RequestDeploymentResult } from "@/app-services/deployment-service.ts"
import type { Deployment } from "@/domain/deployment.ts"
import { createDeployController } from "./deploy-controller.ts"

const zipBlob = (files: Record<string, string>) => {
    const zip = new AdmZip()
    for (const [name, content] of Object.entries(files)) {
        zip.addFile(name, Buffer.from(content))
    }
    return new Blob([new Uint8Array(zip.toBuffer())])
}

const deployRequest = (blob: Blob = zipBlob({ "index.js": "x" })) => {
    const formData = new FormData()
    formData.set("artifact", blob, "artifact.zip")
    return new Request("http://localhost/update/my-app", { method: "POST", body: formData })
}

const uploadedPaths: string[] = []

afterEach(() => {
    for (const path of uploadedPaths.splice(0)) {
        rmSync(path, { force: true })
    }
})

describe("deploy controller: POST /update/:appname", () => {
    it("responds 202 with the deployment id and hands the uploaded zip to the service", async () => {
        const requestDeployment = vi.fn(async (_appName: string, zipFilePath: string): Promise<RequestDeploymentResult> => {
            uploadedPaths.push(zipFilePath)

            expect(existsSync(zipFilePath)).toBe(true)
            const zip = new AdmZip(readFileSync(zipFilePath))
            expect(zip.getEntries().map(entry => entry.entryName)).toEqual(["index.js"])

            return { ok: true, deploymentId: "dep-1", completed: Promise.resolve({} as Deployment) }
        })

        const controller = createDeployController({
            deploymentService: { requestDeployment, getLatestDeployment: vi.fn() },
        })

        const response = await controller.postUpdate(deployRequest(), "my-app")

        expect(response.status).toBe(202)
        expect(await response.json()).toEqual({ deploymentId: "dep-1" })
        expect(requestDeployment).toHaveBeenCalledWith("my-app", expect.any(String))
    })

    it("responds 400 when the body is not multipart", async () => {
        const requestDeployment = vi.fn()
        const controller = createDeployController({
            deploymentService: { requestDeployment, getLatestDeployment: vi.fn() },
        })

        const response = await controller.postUpdate(
            new Request("http://localhost/update/my-app", { method: "POST", body: "just text" }),
            "my-app",
        )

        expect(response.status).toBe(400)
        expect(requestDeployment).not.toHaveBeenCalled()
    })

    it("responds 400 when the multipart body has no artifact file", async () => {
        const formData = new FormData()
        formData.set("something-else", "value")

        const requestDeployment = vi.fn()
        const controller = createDeployController({
            deploymentService: { requestDeployment, getLatestDeployment: vi.fn() },
        })

        const response = await controller.postUpdate(
            new Request("http://localhost/update/my-app", { method: "POST", body: formData }),
            "my-app",
        )

        expect(response.status).toBe(400)
        expect(requestDeployment).not.toHaveBeenCalled()
    })

    it("responds 400 for an unknown app name and removes the uploaded zip", async () => {
        let seenZipFilePath = ""
        const controller = createDeployController({
            deploymentService: {
                requestDeployment: vi.fn(async (_a, zipFilePath: string): Promise<RequestDeploymentResult> => {
                    seenZipFilePath = zipFilePath
                    uploadedPaths.push(zipFilePath)
                    return { ok: false, code: "unknown-app" }
                }),
                getLatestDeployment: vi.fn(),
            },
        })

        const response = await controller.postUpdate(deployRequest(), "ghost")

        expect(response.status).toBe(400)
        expect(existsSync(seenZipFilePath)).toBe(false)
    })

    it("responds 409 with the in-flight deployment id and removes the uploaded zip", async () => {
        let seenZipFilePath = ""
        const controller = createDeployController({
            deploymentService: {
                requestDeployment: vi.fn(async (_a, zipFilePath: string): Promise<RequestDeploymentResult> => {
                    seenZipFilePath = zipFilePath
                    uploadedPaths.push(zipFilePath)
                    return { ok: false, code: "conflict", deploymentId: "dep-active" }
                }),
                getLatestDeployment: vi.fn(),
            },
        })

        const response = await controller.postUpdate(deployRequest(), "my-app")

        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ deploymentId: "dep-active" })
        expect(existsSync(seenZipFilePath)).toBe(false)
    })
})

describe("deploy controller: GET /update/:appname/status", () => {
    it("responds 404 when the app has no deployment", async () => {
        const controller = createDeployController({
            deploymentService: { requestDeployment: vi.fn(), getLatestDeployment: vi.fn(() => undefined) },
        })

        const response = await controller.getStatus("my-app")

        expect(response.status).toBe(404)
    })

    it("echoes the deployment id, state and reason", async () => {
        const controller = createDeployController({
            deploymentService: {
                requestDeployment: vi.fn(),
                getLatestDeployment: vi.fn(
                    (): Deployment => ({ id: "dep-1", appName: "my-app", state: "failed", reason: "boom" }),
                ),
            },
        })

        const response = await controller.getStatus("my-app")

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ deploymentId: "dep-1", state: "failed", reason: "boom" })
    })
})
