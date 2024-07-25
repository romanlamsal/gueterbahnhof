import path from "path"
import { getAppConfig } from "./appConfigDb"
import { startOrReload } from "../pm"
import { existsSync } from "node:fs"
import { getServerConfig } from "../activeConfig"

export type AppState = { state: "no-entry" | "started" | "errored-start" | "pending" }

const appStates: {
    [name: string]: AppState
} = {}

export const listAppState = () => appStates

export const updateAppState = async (appName: string) => {
    const { appDir } = getServerConfig()

    appStates[appName] = { state: "pending" }

    const appConfig = getAppConfig(appName)

    if (!appConfig) {
        return {
            ok: false,
            reason: "No config found.",
        }
    }

    const entryPath = path.resolve(path.join(appDir, appName, appConfig.entry))

    if (!existsSync(entryPath)) {
        appStates[appName] = {
            state: "no-entry",
        }
        return
    }

    const appIsStarted = await startOrReload({
        env: appConfig.env,
        name: appName,
        script: entryPath,
    })
        .then(() => true)
        .catch(() => false)

    if (!appIsStarted) {
        console.warn("Could not start app:", appIsStarted)
    }

    appStates[appName] = {
        state: appIsStarted ? "started" : "errored-start",
    }

    return appIsStarted
}

export const deleteAppState = (appName: string) => {
    delete appStates[appName]
}
