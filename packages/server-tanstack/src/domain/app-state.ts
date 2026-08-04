// The observed runtime condition of an app. 'no-artifact' is the reborn
// legacy 'no-entry' signal: a config exists but nothing was ever deployed.
export type AppState = "online" | "stopped" | "pending" | "no-artifact"

export const deriveAppState = (processStatus: string | undefined, hasArtifact: boolean): AppState => {
    if (!hasArtifact) {
        return "no-artifact"
    }

    if (processStatus === "online") {
        return "online"
    }

    if (processStatus === "launching" || processStatus === "stopping") {
        return "pending"
    }

    return "stopped"
}
