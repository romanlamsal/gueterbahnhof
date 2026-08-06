import type { ProcessDescription, StartOptions } from "pm2"
import pm2 from "pm2"
import type { AppProcessSpec, ManagedProcess, ProcessManager, ProcessOutcome } from "./process-manager.ts"

function log(...parts: unknown[]) {
    console.log("[pm2]", ...parts)
}

// Prefix every app log line with a readable timestamp (24h).
const LOG_DATE_FORMAT = "YYYY-MM-DD HH:mm:ss"

// A grouping label, NOT a boundary: pm2 resolves stop/delete/describe by name
// across every namespace, so this only groups the fleet in `pm2 list` and
// enables `pm2 stop gueterbahnhof` as a manual lever. See ADR-0004.
export const FLEET_NAMESPACE = "gueterbahnhof"

const toStartOptions = (spec: AppProcessSpec): StartOptions => ({
    name: spec.name,
    script: spec.entry,
    cwd: spec.cwd,
    env: spec.env,
    namespace: FLEET_NAMESPACE,
    log_date_format: LOG_DATE_FORMAT,
})

// pm2 sets pm2_env.namespace at runtime but omits it from its types.
const namespaceOf = (proc: ProcessDescription) => (proc.pm2_env as { namespace?: string } | undefined)?.namespace

const toManagedProcess = (proc: ProcessDescription): ManagedProcess => ({
    name: proc.name ?? "",
    status: proc.pm2_env?.status ?? "unknown",
})

const failed = (error: unknown, fallback: string): ProcessOutcome => ({
    ok: false,
    reason: error instanceof Error ? error.message : fallback,
})

// Daemon mode (ADR-0003): the daemon outlives us, so several clients — the CLI
// process and the server module — can drive one fleet. Connecting is idempotent
// and lazy, so whichever side needs pm2 first pays for it.
let connection: Promise<typeof pm2> | undefined

export const connectProcessManager = () => {
    connection ??= new Promise<typeof pm2>((resolve, reject) => {
        pm2.connect(err => {
            if (err) {
                connection = undefined
                return reject(err instanceof Error ? err : new Error(String(err)))
            }

            log(`Connected to the daemon (PM2_HOME=${process.env.PM2_HOME ?? "default"}).`)
            resolve(pm2)
        })
    })

    return connection
}

export const pm2ProcessManager: ProcessManager = {
    async getAppProcess(appName) {
        await connectProcessManager()

        return new Promise<ManagedProcess | undefined>(resolve => {
            pm2.describe(appName, (err, processList) => {
                if (err) {
                    console.error("Error describing app '" + appName + "':", err.stack)
                    return resolve(undefined)
                }

                const proc = processList?.[0]
                return resolve(proc ? toManagedProcess(proc) : undefined)
            })
        })
    },

    // Reading the list is namespace-safe (we filter ourselves); only addressing
    // by name is collision-prone, which ADR-0004 accepted knowingly.
    async listFleetProcesses() {
        await connectProcessManager()

        return new Promise<ManagedProcess[]>(resolve => {
            pm2.list((err, processList) => {
                if (err) {
                    console.error("Error listing processes:", err.stack)
                    return resolve([])
                }

                resolve((processList ?? []).filter(proc => namespaceOf(proc) === FLEET_NAMESPACE).map(toManagedProcess))
            })
        })
    },

    async startAppProcess(spec) {
        // The one place that knows an App cannot start without an Entry, so
        // callers get a reason instead of an ambiguous falsy return.
        if (!spec.entry) {
            return { ok: false, reason: "no Entry configured" }
        }

        await connectProcessManager()

        return new Promise<ProcessOutcome>(resolve => {
            log(`Starting app '${spec.name}'.`)
            pm2.start(structuredClone(toStartOptions(spec)), startErr => {
                if (startErr) {
                    console.error("Start error:", startErr)
                    return resolve(failed(startErr, "the process manager refused to start it"))
                }

                return resolve({ ok: true })
            })
        })
    },

    async stopAppProcess(appName) {
        await connectProcessManager()

        return new Promise<ProcessOutcome>(resolve => {
            log(`Stopping app '${appName}'.`)
            pm2.stop(appName, err => {
                // Not found is the common case on a fresh boot; don't shout.
                resolve(err ? failed(err, "could not stop it") : { ok: true })
            })
        })
    },

    async deleteAppProcess(appName) {
        await connectProcessManager()

        return new Promise<ProcessOutcome>(resolve => {
            pm2.delete(appName, err => {
                resolve(err ? failed(err, "could not remove it") : { ok: true })
            })
        })
    },

    // Recreate rather than restart: pm2 keeps the environment it was started
    // with, so a plain restart can run an app with stale env (ADR-0003).
    async recreateAppProcess(spec) {
        await this.stopAppProcess(spec.name)
        await this.deleteAppProcess(spec.name)

        return this.startAppProcess(spec)
    },
}
