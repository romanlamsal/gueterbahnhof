import type { Proc, ProcessDescription, StartOptions } from "pm2"
import pm2 from "pm2"

function log(...parts: unknown[]) {
    console.log("[pm2]", ...parts)
}

type AppProcessStartOptions = Omit<StartOptions, "name" | "namespace"> & { name: string }

export const pm2Service = {
    getAppProcess(appName: string) {
        return new Promise<ProcessDescription | undefined>(resolve => {
            pm2.describe(appName, (err, processList) => {
                if (err) {
                    console.log("ERR", err, typeof err, err.stack)
                    resolve(undefined)
                    return
                }

                return resolve(processList?.[0])
            })
        })
    },

    startAppProcess(startOptions: AppProcessStartOptions) {
        if (!startOptions.script) {
            return
        }

        return new Promise(resolve => {
            log(`Starting app '${startOptions.name}'.`)
            pm2.start(structuredClone(startOptions), (startErr, proc) => {
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

    async startOrRestartAppProcess(startOptions: AppProcessStartOptions) {
        const appProcess = await this.getAppProcess(startOptions.name)
        if (appProcess) {
            await this.stopAppProcess(startOptions.name)
        }

        return this.startAppProcess(startOptions)
    },
}

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
