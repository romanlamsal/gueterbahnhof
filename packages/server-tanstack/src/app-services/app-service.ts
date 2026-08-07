import { needsRecreate } from "@/domain/app-config-change.ts"
import { deriveAppState } from "@/domain/app-state.ts"
import { findOrphanProcessNames } from "@/domain/fleet.ts"
import { candidatePorts, claimedPorts, needsAssignedPort } from "@/domain/port-assignment.ts"
import type { AppConfig, AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { ArtifactStore } from "@/interface-services/artifact-store.ts"
import type { PortProbe } from "@/interface-services/port-probe.ts"
import { type ProcessManager, toProcessSpec } from "@/interface-services/process-manager.ts"

export type AppMutationResult =
    | { ok: true; config: AppConfig }
    | { ok: false; code: "not-found" | "name-taken" | "invalid" }

export const createAppService = ({
    configRepository,
    processManager,
    artifactStore,
    portProbe,
}: {
    configRepository: AppConfigRepository
    processManager: ProcessManager
    artifactStore: Pick<ArtifactStore, "getAppDir" | "deleteAppDir" | "hasArtifact">
    portProbe: PortProbe
}) => {
    const specFor = (config: AppConfig) => toProcessSpec(config, artifactStore.getAppDir(config.id))

    const firstFreePort = async (claimed: ReadonlySet<number>) => {
        for (const candidate of candidatePorts(claimed)) {
            if (await portProbe.isPortFree(candidate)) {
                return candidate
            }
        }

        return undefined
    }

    // Serialized on purpose, and persisted before the next App is considered:
    // reconciliation starts the Fleet concurrently, so probing during start
    // would let two Apps see the same port as free. A durable claim is what
    // makes the next candidate skip it, rather than a race between probes.
    //
    // Writes go through the repository rather than this service, because
    // updateAppConfig recreates a process on a qualifying change and would
    // recurse into starting the App being assigned to.
    const assignPorts = async (
        // Claims come from the whole Fleet; only `targets` may receive one.
        fleet: AppConfig[],
        targets: AppConfig[],
        reservedPorts: readonly number[],
    ) => {
        const eligible = targets.filter(needsAssignedPort)

        if (eligible.length === 0) {
            return targets
        }

        const claimed = claimedPorts(fleet, reservedPorts)
        const assigned = new Map<string, number>()

        for (const config of eligible) {
            const port = await firstFreePort(claimed)

            if (port === undefined) {
                console.warn(`Could not assign a port to '${config.name}': no free port left in the range.`)
                continue
            }

            claimed.add(port)

            if (!(await configRepository.updateAppConfig(config.id, { port }))) {
                console.warn(`Could not save the port assigned to '${config.name}'.`)
                continue
            }

            assigned.set(config.id, port)
            console.log(`Assigned port ${port} to '${config.name}'.`)
        }

        return targets.map(config => {
            const port = assigned.get(config.id)

            return port === undefined ? config : { ...config, port }
        })
    }

    // A Proxy Host set through the UI must become reachable without waiting for
    // a server restart, so the same pass runs on a config save.
    const withAssignedPort = async (config: AppConfig) => {
        if (!needsAssignedPort(config)) {
            return config
        }

        const [assigned] = await assignPorts(await configRepository.listAppConfigs(), [config], [])

        return assigned ?? config
    }

    const nameTakenByOther = async (name: string | undefined, appId: string) => {
        if (!name) {
            return false
        }

        const existing = await configRepository.findAppConfigByName(name)
        return !!existing && existing.id !== appId
    }

    return {
        // Boot: recreate every configured app and reclaim labelled processes that
        // no longer have a config (ADR-0003). Recreate rather than restart, since
        // pm2 keeps the env a process was started with.
        async reconcileFleet({ reservedPorts = [] }: { reservedPorts?: readonly number[] } = {}) {
            const loaded = await configRepository.listAppConfigs()
            // Before the fan-out below, never during it.
            const configs = await assignPorts(loaded, loaded, reservedPorts)

            const outcomes = await Promise.all(
                configs.map(config => processManager.recreateAppProcess(specFor(config))),
            )

            const runningFleet = await processManager.listFleetProcesses()
            const orphans = findOrphanProcessNames(
                configs.map(config => config.name),
                runningFleet.map(proc => proc.name),
            )

            for (const orphanName of orphans) {
                console.log(`Reclaiming '${orphanName}': labelled as ours but no config exists.`)
                await processManager.stopAppProcess(orphanName)
                await processManager.deleteAppProcess(orphanName)
            }

            const failures = configs
                .map((config, index) => ({ config, outcome: outcomes[index] }))
                .filter(({ outcome }) => !outcome?.ok)

            for (const { config, outcome } of failures) {
                console.warn(`Did not start '${config.name}': ${outcome?.ok === false ? outcome.reason : "unknown"}.`)
            }

            console.log(
                `Started ${outcomes.length - failures.length} of ${configs.length} apps` +
                    (orphans.length ? `, reclaimed ${orphans.length} orphan(s).` : "."),
            )
        },

        // Shutdown: take down our own apps and nothing else. The daemon and any
        // process we did not configure survive (ADR-0003).
        async stopFleet() {
            const configs = await configRepository.listAppConfigs()

            const outcomes = await Promise.all(configs.map(config => processManager.deleteAppProcess(config.name)))

            console.log(`Stopped ${outcomes.filter(outcome => outcome.ok).length} of ${configs.length} apps.`)
        },

        async listApps() {
            const configs = await configRepository.listAppConfigs()

            return Promise.all(
                configs.map(async config => {
                    const managed = await processManager.getAppProcess(config.name)

                    return {
                        config,
                        state: deriveAppState(managed?.status, await artifactStore.hasArtifact(config.id)),
                    }
                }),
            )
        },

        async createApp(appId: string, name?: string, env?: AppConfig["env"]): Promise<AppMutationResult> {
            const appName = name ?? appId

            if (await nameTakenByOther(appName, appId)) {
                return { ok: false, code: "name-taken" }
            }

            const config = await configRepository.createAppConfig(appId, appName, env)

            if (!config) {
                return { ok: false, code: "invalid" }
            }

            return { ok: true, config }
        },

        async updateAppConfig(appId: string, partial: Partial<AppConfig>): Promise<AppMutationResult> {
            const current = await configRepository.getAppConfig(appId)

            if (!current) {
                return { ok: false, code: "not-found" }
            }

            if (await nameTakenByOther(partial.name, appId)) {
                return { ok: false, code: "name-taken" }
            }

            const response = await configRepository.updateAppConfig(appId, partial)

            if (!response) {
                return { ok: false, code: "invalid" }
            }

            const [prevConfig, savedConfig] = response
            const currConfig = await withAssignedPort(savedConfig)

            if (!(await processManager.getAppProcess(prevConfig.name))) {
                return { ok: true, config: currConfig }
            }

            if (needsRecreate(prevConfig, currConfig)) {
                if (prevConfig.name !== currConfig.name) {
                    // Nothing stray: the old name would otherwise linger.
                    await processManager.stopAppProcess(prevConfig.name)
                    await processManager.deleteAppProcess(prevConfig.name)
                }

                await processManager.recreateAppProcess(specFor(currConfig))
            }

            return { ok: true, config: currConfig }
        },

        async deleteApp(appId: string): Promise<{ ok: true } | { ok: false; code: "not-found" }> {
            const config = await configRepository.getAppConfig(appId)

            if (!config) {
                return { ok: false, code: "not-found" }
            }

            await processManager.stopAppProcess(config.name)
            await processManager.deleteAppProcess(config.name)
            await configRepository.deleteAppConfig(appId)
            await artifactStore.deleteAppDir(appId)

            return { ok: true }
        },
    }
}

export type AppService = ReturnType<typeof createAppService>
