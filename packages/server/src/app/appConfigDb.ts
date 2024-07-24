import { type LowSync } from "lowdb"
import { JSONFileSyncPreset } from "lowdb/node"
import { join } from "node:path"

export type AppConfig = {
    name: string
    entry: string
    env?: { [key: string]: string }
}

let appConfigDb: LowSync<{ [name: string]: AppConfig }>

export const initAppConfigsDb = (location: string) => {
    appConfigDb = JSONFileSyncPreset(join(location, "apps.json"), {})
}

export const listAppConfigs = () => Object.values(appConfigDb.data)

export const getAppConfig = (appName: string) => {
    const appConfig = appConfigDb.data[appName]

    if ("io" in appConfig.env && appConfig.env.io === undefined) {
        console.debug("Removing mysterious 'io'")
        delete appConfig.env.io
    }

    return appConfig
}

export const saveAppConfig = (appConfig: AppConfig) => {
    appConfigDb.data[appConfig.name] = appConfig
    appConfigDb.write()
}

export const deleteAppConfig = (appName: string) => {
    delete appConfigDb.data[appName]
    appConfigDb.write()
}
