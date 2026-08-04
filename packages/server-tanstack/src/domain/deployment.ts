// A Deployment is a single artifact update for one app, from upload through
// extract and start to a terminal outcome. See ADR-0001.

export type DeploymentState = "extracting" | "starting" | "succeeded" | "failed"

export type Deployment = {
    id: string
    appName: string
    state: DeploymentState
    reason?: string
}

const allowedTransitions: Record<DeploymentState, DeploymentState[]> = {
    extracting: ["starting", "failed"],
    starting: ["succeeded", "failed"],
    succeeded: [],
    failed: [],
}

export const createDeployment = (id: string, appName: string): Deployment => ({
    id,
    appName,
    state: "extracting",
})

export const transitionDeployment = (
    deployment: Deployment,
    nextState: DeploymentState,
    reason?: string,
): Deployment | undefined => {
    if (!allowedTransitions[deployment.state].includes(nextState)) {
        return undefined
    }

    return {
        ...deployment,
        state: nextState,
        ...(reason !== undefined ? { reason } : {}),
    }
}

export const isTerminal = (deployment: Deployment) => allowedTransitions[deployment.state].length === 0

// At most one Deployment is in flight per app (ADR-0001).
export const isInFlight = (deployment: Deployment | undefined): deployment is Deployment =>
    !!deployment && !isTerminal(deployment)

export const canStartDeployment = (activeDeployment: Deployment | undefined) => !isInFlight(activeDeployment)
