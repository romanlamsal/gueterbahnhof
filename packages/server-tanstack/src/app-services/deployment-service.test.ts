import { describe, expect, it, vi } from "vitest"
import type { AppConfig } from "@/interface-services/app-config-repository.ts"
import { createDeploymentService } from "./deployment-service.ts"

const makeFakes = ({
    configs = [{ id: "id-1", name: "my-app", entry: "index.js", env: { FOO: "bar" } }],
    extract = vi.fn(async () => "/extracted/id-1"),
    start = vi.fn(async () => ({}) as unknown),
}: {
    configs?: AppConfig[]
    extract?: ReturnType<typeof vi.fn>
    start?: ReturnType<typeof vi.fn>
} = {}) => {
    let nextId = 0

    const deps = {
        configRepository: {
            findAppConfigByName: async (name: string) => configs.find(config => config.name === name),
        },
        artifactStore: {
            getAppDir: (appId: string) => `/apps/${appId}`,
            extractArtifact: extract,
        },
        processManager: {
            startOrRestartAppProcess: start,
        },
        generateId: () => `dep-${++nextId}`,
    }

    return { deps: deps as unknown as Parameters<typeof createDeploymentService>[0], extract, start }
}

describe("deploymentService", () => {
    it("runs a deployment to 'succeeded': extract, then start with the app dir as cwd", async () => {
        const { deps, extract, start } = makeFakes()
        const service = createDeploymentService(deps)

        const result = await service.requestDeployment("my-app", "/tmp/upload.zip")

        expect(result).toMatchObject({ ok: true, deploymentId: "dep-1" })
        if (!result.ok) {
            throw new Error("unreachable")
        }

        const deployment = await result.completed
        expect(deployment.state).toBe("succeeded")

        expect(extract).toHaveBeenCalledWith("id-1", "/tmp/upload.zip")
        expect(start).toHaveBeenCalledWith({
            name: "my-app",
            entry: "index.js",
            env: { FOO: "bar" },
            cwd: "/apps/id-1",
        })
    })

    it("rejects a deployment for an unknown app name", async () => {
        const { deps, extract } = makeFakes()
        const service = createDeploymentService(deps)

        const result = await service.requestDeployment("nope", "/tmp/upload.zip")

        expect(result).toEqual({ ok: false, code: "unknown-app" })
        expect(extract).not.toHaveBeenCalled()
        expect(service.getLatestDeployment("nope")).toBeUndefined()
    })

    it("reports the latest deployment for an app", async () => {
        const { deps } = makeFakes()
        const service = createDeploymentService(deps)

        const result = await service.requestDeployment("my-app", "/tmp/upload.zip")
        if (!result.ok) {
            throw new Error("unreachable")
        }
        await result.completed

        const latest = service.getLatestDeployment("my-app")
        expect(latest).toMatchObject({ id: "dep-1", appName: "my-app", state: "succeeded" })
    })

    it("is 'extracting' immediately after the request is accepted", async () => {
        let releaseExtract = () => {}
        const blockedExtract = vi.fn(
            () =>
                new Promise<string>(resolve => {
                    releaseExtract = () => resolve("/apps/id-1")
                }),
        )
        const { deps } = makeFakes({ extract: blockedExtract })
        const service = createDeploymentService(deps)

        const result = await service.requestDeployment("my-app", "/tmp/upload.zip")
        if (!result.ok) {
            throw new Error("unreachable")
        }

        expect(service.getLatestDeployment("my-app")?.state).toBe("extracting")

        releaseExtract()
        await result.completed
        expect(service.getLatestDeployment("my-app")?.state).toBe("succeeded")
    })
})
