import path from "path"
import { getAppConfig } from "./appConfigDb"
import { startOrReload } from "../pm"
import { existsSync } from "node:fs"

const appState: {
    [name: string]: { state: "no-entry" | "started" | "errored-start" | "pending" }
} = {}

export const listAppState = () => appState

export const updateAppState = async (appDir: string, appName: string) => {
    appState[appName] = { state: "pending" }

    const appConfig = getAppConfig(appName)

    if (!appConfig) {
        return {
            ok: false,
            reason: "No config found.",
        }
    }

    const entryPath = path.resolve(path.join(appDir, appName, appConfig.entry))

    if (!existsSync(entryPath)) {
        appState[appName] = {
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

    appState[appName] = {
        state: appIsStarted ? "started" : "errored-start",
    }

    return appIsStarted
}
