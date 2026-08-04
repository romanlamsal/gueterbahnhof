import { randomUUID } from "node:crypto"
import {
    canStartDeployment,
    createDeployment,
    type Deployment,
    transitionDeployment,
} from "@/domain/deployment.ts"
import type { AppConfig, AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { ArtifactStore } from "@/interface-services/artifact-store.ts"
import type { ProcessManager } from "@/interface-services/pm-service.ts"

// Deployment records are in-memory only, capped per app (ADR-0001).
const MAX_DEPLOYMENTS_PER_APP = 5

export type RequestDeploymentResult =
    | { ok: true; deploymentId: string; completed: Promise<Deployment> }
    | { ok: false; code: "unknown-app" }
    | { ok: false; code: "conflict"; deploymentId: string }

export const createDeploymentService = ({
    configRepository,
    artifactStore,
    processManager,
    generateId = randomUUID,
}: {
    configRepository: Pick<AppConfigRepository, "findAppConfigByName">
    artifactStore: Pick<ArtifactStore, "getAppDir" | "extractArtifact">
    processManager: Pick<ProcessManager, "startOrRestartAppProcess">
    generateId?: () => string
}) => {
    const deploymentsByApp = new Map<string, Deployment[]>()

    const record = (deployment: Deployment) => {
        const deployments = deploymentsByApp.get(deployment.appName) ?? []
        const withoutSelf = deployments.filter(existing => existing.id !== deployment.id)
        withoutSelf.push(deployment)
        deploymentsByApp.set(deployment.appName, withoutSelf.slice(-MAX_DEPLOYMENTS_PER_APP))
        return deployment
    }

    const transition = (deployment: Deployment, nextState: Deployment["state"], reason?: string) => {
        const next = transitionDeployment(deployment, nextState, reason)

        if (!next) {
            console.error(`Invalid deployment transition ${deployment.state} -> ${nextState}, ignoring.`)
            return deployment
        }

        return record(next)
    }

    const runDeployment = async (deployment: Deployment, config: AppConfig, zipFilePath: string) => {
        let current = deployment

        try {
            await artifactStore.extractArtifact(config.id, zipFilePath)
        } catch (error) {
            console.error(`Deployment ${current.id}: extract failed:`, error)
            return transition(current, "failed", "Could not extract the artifact.")
        }

        current = transition(current, "starting")

        if (!config.entry) {
            return transition(current, "failed", "No entry configured.")
        }

        const proc = await processManager.startOrRestartAppProcess({
            name: config.name,
            entry: config.entry,
            env: config.env,
            cwd: artifactStore.getAppDir(config.id),
        })

        if (!proc) {
            return transition(current, "failed", "The process failed to start.")
        }

        return transition(current, "succeeded")
    }

    return {
        getLatestDeployment(appName: string): Deployment | undefined {
            return deploymentsByApp.get(appName)?.at(-1)
        },

        async requestDeployment(appName: string, zipFilePath: string): Promise<RequestDeploymentResult> {
            const config = await configRepository.findAppConfigByName(appName)

            if (!config) {
                return { ok: false, code: "unknown-app" }
            }

            const active = this.getLatestDeployment(appName)
            if (!canStartDeployment(active)) {
                return { ok: false, code: "conflict", deploymentId: (active as Deployment).id }
            }

            const deployment = record(createDeployment(generateId(), appName))

            return {
                ok: true,
                deploymentId: deployment.id,
                completed: runDeployment(deployment, config, zipFilePath),
            }
        },
    }
}

export type DeploymentService = ReturnType<typeof createDeploymentService>
