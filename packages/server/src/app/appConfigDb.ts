import { type LowSync } from "lowdb"
import { JSONFileSyncPreset } from "lowdb/node"
import { join } from "node:path"

type AppConfig = {
    name: string
    entry: string
    env?: { [key: string]: string }
}

let appConfigDb: LowSync<{ [name: string]: AppConfig }>

export const initAppConfigsDb = (location: string) => {
    appConfigDb = JSONFileSyncPreset(join(location, "apps.json"), {})
}

export const listAppConfigs = () => Object.values(appConfigDb.data)

export const getAppConfig = (appName: string) => appConfigDb.data[appName]

export const saveAppConfig = (appConfig: AppConfig) => {
    appConfigDb.data[appConfig.name] = appConfig
    appConfigDb.write()
}
