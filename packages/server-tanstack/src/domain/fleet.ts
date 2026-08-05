// Processes carrying our namespace label that no longer have a config — left
// behind by a deleted config or an older version. Boot reclaims them.
export const findOrphanProcessNames = (configuredNames: string[], runningFleetNames: string[]) => {
    const configured = new Set(configuredNames)

    return [...new Set(runningFleetNames)].filter(name => !configured.has(name))
}
