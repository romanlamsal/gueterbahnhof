import { rm } from "node:fs/promises"
import type { DeploymentService } from "@/app-services/deployment-service.ts"
import { saveArtifactUpload } from "./artifact-upload.ts"

export const createDeployController = ({
    deploymentService,
}: {
    deploymentService: Pick<DeploymentService, "requestDeployment" | "getLatestDeployment" | "listDeployments">
}) => ({
    async postUpdate(request: Request, appName: string): Promise<Response> {
        const zipFilePath = await saveArtifactUpload(request).catch(error => {
            console.error("Failed to read artifact upload:", error)
            return undefined
        })

        if (!zipFilePath) {
            return Response.json(
                { error: "Expected multipart/form-data with an 'artifact' file." },
                { status: 400 },
            )
        }

        const result = await deploymentService.requestDeployment(appName, zipFilePath)

        if (!result.ok) {
            await rm(zipFilePath, { force: true })

            if (result.code === "unknown-app") {
                return Response.json({ error: `App '${appName}' not found.` }, { status: 400 })
            }

            return Response.json(
                { error: "A deployment is already in flight for this app.", deploymentId: result.deploymentId },
                { status: 409 },
            )
        }

        return Response.json({ deploymentId: result.deploymentId }, { status: 202 })
    },

    // With ?deploymentId= a waiter gets ITS deployment as long as the record
    // is retained — a later deploy can no longer shadow the outcome.
    async getStatus(appName: string, deploymentId?: string): Promise<Response> {
        const deployment = deploymentId
            ? deploymentService.listDeployments(appName).find(candidate => candidate.id === deploymentId)
            : deploymentService.getLatestDeployment(appName)

        if (!deployment) {
            return Response.json({ error: `No deployment found for app '${appName}'.` }, { status: 404 })
        }

        return Response.json({
            deploymentId: deployment.id,
            state: deployment.state,
            ...(deployment.reason !== undefined ? { reason: deployment.reason } : {}),
        })
    },
})

export type DeployController = ReturnType<typeof createDeployController>
