import type { Proc, ProcessDescription, StartOptions } from "pm2"
import pm2 from "pm2"

function log(...parts: unknown[]) {
    console.log("[pm2]", ...parts)
}

// The domain speaks 'entry'; pm2's 'script' never leaves this adapter.
export type AppProcessSpec = {
    name: string
    entry?: string
    cwd?: string
    env?: Record<string, string>
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

// Shared config -> process-spec mapping: the app runs inside its app dir.
export const toProcessSpec = (
    config: { name: string; entry?: string; env?: Record<string, string> },
    appDir: string,
): AppProcessSpec => ({
    name: config.name,
    entry: config.entry,
    env: config.env,
    cwd: appDir,
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

export const pm2ProcessManager = {
    async getAppProcess(appName: string) {
        await connectProcessManager()

        return new Promise<ProcessDescription | undefined>(resolve => {
            pm2.describe(appName, (err, processList) => {
                if (err) {
                    console.error("Error describing app '" + appName + "':", err.stack)
                    resolve(undefined)
                    return
                }

                return resolve(processList?.[0])
            })
        })
    },

    // Reading the list is namespace-safe (we filter ourselves); only addressing
    // by name is collision-prone, which ticket 09 accepted knowingly.
    async listFleetProcesses() {
        await connectProcessManager()

        return new Promise<ProcessDescription[]>(resolve => {
            pm2.list((err, processList) => {
                if (err) {
                    console.error("Error listing processes:", err.stack)
                    return resolve([])
                }

                // pm2 sets pm2_env.namespace at runtime but omits it from its types.
                resolve(
                    (processList ?? []).filter(
                        proc => (proc.pm2_env as { namespace?: string } | undefined)?.namespace === FLEET_NAMESPACE,
                    ),
                )
            })
        })
    },

    async startAppProcess(spec: AppProcessSpec) {
        if (!spec.entry) {
            return undefined
        }

        await connectProcessManager()

        return new Promise<Proc | undefined>(resolve => {
            log(`Starting app '${spec.name}'.`)
            pm2.start(structuredClone(toStartOptions(spec)), (startErr, proc) => {
                if (startErr) {
                    console.error("Start error:", startErr)
                    return resolve(undefined)
                }

                return resolve(proc)
            })
        })
    },

    async stopAppProcess(appName: string) {
        await connectProcessManager()

        return new Promise<Proc | void>(resolve => {
            log(`Stopping app '${appName}'.`)
            pm2.stop(appName, (err, proc) => {
                if (err) {
                    // Not found is the common case on a fresh boot; don't shout.
                    resolve(undefined)
                    return
                }

                resolve(proc)
            })
        })
    },

    async deleteAppProcess(appName: string) {
        await connectProcessManager()

        return new Promise<Proc | undefined>(resolve => {
            pm2.delete(appName, (err, proc) => {
                if (err) {
                    resolve(undefined)
                    return
                }

                resolve(proc)
            })
        })
    },

    // Recreate rather than restart: pm2 keeps the environment it was started
    // with, so a plain restart can run an app with stale env (ADR-0003).
    async recreateAppProcess(spec: AppProcessSpec) {
        await this.stopAppProcess(spec.name)
        await this.deleteAppProcess(spec.name)

        return this.startAppProcess(spec)
    },
}

export type ProcessManager = typeof pm2ProcessManager
