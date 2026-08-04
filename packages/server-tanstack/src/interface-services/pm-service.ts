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

const toStartOptions = (spec: AppProcessSpec): StartOptions => ({
    name: spec.name,
    script: spec.entry,
    cwd: spec.cwd,
    env: spec.env,
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

export const pm2Service = {
    getAppProcess(appName: string) {
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

    startAppProcess(spec: AppProcessSpec) {
        if (!spec.entry) {
            return
        }

        return new Promise(resolve => {
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

    stopAppProcess(appName: string) {
        return new Promise<Proc | void>(resolve => {
            log(`Stopping app '${appName}'.`)
            pm2.stop(appName, (err, proc) => {
                if (err) {
                    console.error("Error stopping app '" + appName + "':", err.stack)
                    return resolve(undefined)
                }

                resolve(proc)
            })
        })
    },

    deleteAppProcess(appName: string) {
        return new Promise(resolve => {
            pm2.delete(appName, (err, proc) => {
                if (err) {
                    console.error("Error deleting app '" + appName + "':", err.stack)
                    return resolve(undefined)
                }

                resolve(proc)
            })
        })
    },

    async startOrRestartAppProcess(spec: AppProcessSpec) {
        const appProcess = await this.getAppProcess(spec.name)
        if (appProcess) {
            await this.stopAppProcess(spec.name)
        }

        return this.startAppProcess(spec)
    },
}

export type ProcessManager = typeof pm2Service

export function getPm() {
    return new Promise<typeof pm2>((resolve, reject) => {
        pm2.connect(true, err => {
            if (err) {
                console.error(err)
                return reject(2)
            }

            resolve(pm2)
        })
    })
}
