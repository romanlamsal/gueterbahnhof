import { needsRecreate } from "@/domain/app-config-change.ts"
import { deriveAppState } from "@/domain/app-state.ts"
import { findOrphanProcessNames } from "@/domain/fleet.ts"
import { referencedFleetKeys, resolveFleetReferences } from "@/domain/fleet-env.ts"
import { candidatePorts, claimedPorts, needsAssignedPort } from "@/domain/port-assignment.ts"
import type { AppConfig, AppConfigRepository } from "@/interface-services/app-config-repository.ts"
import type { ArtifactStore } from "@/interface-services/artifact-store.ts"
import type { FleetEnvRepository } from "@/interface-services/fleet-env-repository.ts"
import type { PortProbe } from "@/interface-services/port-probe.ts"
import { type ProcessManager, toProcessSpec } from "@/interface-services/process-manager.ts"

export type AppMutationResult =
    | { ok: true; config: AppConfig }
    | { ok: false; code: "not-found" | "name-taken" | "invalid" }
    // Carries the names, because the operator needs to know WHICH key was
    // mistyped, not merely that one was.
    | { ok: false; code: "unknown-fleet-env"; missing: string[] }

export const createAppService = ({
    configRepository,
    processManager,
    artifactStore,
    portProbe,
    fleetEnvRepository,
}: {
    configRepository: AppConfigRepository
    processManager: ProcessManager
    artifactStore: Pick<ArtifactStore, "getAppDir" | "deleteAppDir" | "hasArtifact">
    portProbe: PortProbe
    fleetEnvRepository: FleetEnvRepository
}) => {
    // Resolved on the way to the process, never on the way to disk: the App
    // Config keeps the reference so a shared value is not copied into it.
    const specFor = (config: AppConfig, fleetEnv: Record<string, string>) => {
        const { env, missing } = resolveFleetReferences(config.env, fleetEnv)

        if (missing.length > 0) {
            return { ok: false as const, reason: `unknown fleet env ${missing.map(name => `'${name}'`).join(", ")}` }
        }

        return { ok: true as const, spec: toProcessSpec({ ...config, env }, artifactStore.getAppDir(config.id)) }
    }

    // Refuses rather than starting an App with a half-substituted value. The
    // reason travels the same route as "no Entry configured", so reconciliation
    // reports it per App without a new channel.
    const recreateWithFleetEnv = async (config: AppConfig, fleetEnv: Record<string, string>) => {
        const resolved = specFor(config, fleetEnv)

        return resolved.ok ? processManager.recreateAppProcess(resolved.spec) : resolved
    }

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

            const fleetEnv = await fleetEnvRepository.readFleetEnv()

            const outcomes = await Promise.all(configs.map(config => recreateWithFleetEnv(config, fleetEnv)))

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

        // A Fleet Env value that changed is a value some Apps are now running
        // on wrongly. Only those Apps, and only for keys that actually moved.
        async recreateAppsReferencing(keys: ReadonlySet<string>) {
            if (keys.size === 0) {
                return
            }

            const configs = await configRepository.listAppConfigs()
            const affected = configs.filter(config => [...referencedFleetKeys(config.env)].some(key => keys.has(key)))

            if (affected.length === 0) {
                return
            }

            const fleetEnv = await fleetEnvRepository.readFleetEnv()

            for (const config of affected) {
                const outcome = await recreateWithFleetEnv(config, fleetEnv)

                if (!outcome.ok) {
                    console.warn(`Did not restart '${config.name}' after a fleet env change: ${outcome.reason}.`)
                }
            }

            console.log(`Restarted ${affected.length} app(s) after a fleet env change.`)
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

            // Refused before anything is written: a mistyped reference is
            // caught where it was made, rather than becoming an App that has
            // quietly stopped with the reason only in the log.
            const { missing } = resolveFleetReferences(
                partial.env ?? current.env,
                await fleetEnvRepository.readFleetEnv(),
            )

            if (missing.length > 0) {
                return { ok: false, code: "unknown-fleet-env", missing }
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

                await recreateWithFleetEnv(currConfig, await fleetEnvRepository.readFleetEnv())
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
