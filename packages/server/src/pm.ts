import type { StartOptions } from "pm2";
import pm2 from "pm2"

function log(...parts: string[]) {
    console.log("[pm2]", ...parts)
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

export function startOrReload(startOptions: StartOptions) {
    return new Promise((resolve, reject) => {
        pm2.describe(startOptions.name, async (err, processDescriptionList) => {
            if (err) {
                return reject(err)
            }

            if (processDescriptionList.length && processDescriptionList[0].pm2_env.status === "online") {
                /*log(`Reloading app '${startOptions.name}'.`)
                pm2.reload(startOptions.name, (err, proc) => {
                    if (err) {
                        return reject(err)
                    }

                    resolve(proc)
                })*/
                await stopApp(startOptions.name)
            }

            log(`Starting app '${startOptions.name}'.`)
            pm2.start(startOptions, (err, proc) => {
                if (err) {
                    return reject(err)
                }

                resolve(proc)
            })
        })
    })
}

export function stopApp(appName: string) {
    return new Promise(resolve => {
        log(`Stopping app '${appName}'.`)
        pm2.stop(appName, () => {
            resolve(true)
        })
    })
}
