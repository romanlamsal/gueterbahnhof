import pm2 from "pm2"
import { App } from "@gueterbahnhof/common/App"
import { appToStartOptions } from "./apps"

function log(...parts: string[]) {
    console.log("[pm2]", ...parts)
}

export function getPm(): Promise<typeof pm2> {
    return new Promise((resolve, reject) => {
        pm2.connect(true, err => {
            if (err) {
                console.error(err)
                return reject(2)
            }
            resolve(pm2)
        })
    })
}

export function startOrReloadApp(app: App) {
    return new Promise((resolve, reject) => {
        pm2.describe(app.name, (err, processDescriptionList) => {
            if (err) {
                return reject(err)
            }

            if (processDescriptionList.length && processDescriptionList[0].pm2_env.status === "online") {
                log(`Reloading app '${app.name}'.`)
                pm2.reload(app.name, (err, proc) => {
                    if (err) {
                        return reject(err)
                    }

                    resolve(proc)
                })
            } else {
                log(`Starting app '${app.name}'.`)
                pm2.start(appToStartOptions(app), (err, proc) => {
                    if (err) {
                        return reject(err)
                    }

                    resolve(proc)
                })
            }
        })
    })
}

export function stopApp({ name }: App) {
    return new Promise((resolve, reject) => {
        log(`Stopping app '${name}'.`)
        pm2.stop(name, (err, proc) => {
            if (err) {
                return reject(err)
            }

            resolve(proc)
        })
    })
}
