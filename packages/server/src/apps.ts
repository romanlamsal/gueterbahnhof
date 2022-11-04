import { App } from "@gueterbahnhof/common/App"
import * as fs from "fs/promises"
import path from "path"
import { StartOptions } from "pm2"

export let appDir: string

const apps: App[] = []

export const toAppPath = (...parts: string[]) => path.join(appDir, ...parts)

export const loadApps = async (location: string): Promise<void> => {
    appDir = location

    const appsPath = toAppPath("apps.json")

    const loadedApps: Omit<App, "pending">[] = await fs
        .readFile(appsPath)
        .then(content => JSON.parse(content.toString()))
        .catch(() => [])

    apps.push(
        ...(await Promise.all(
            loadedApps.map(async app => {
                const exists = await fs
                    .access(toAppPath(app.id, app.service.config.entry))
                    .then(() => true)
                    .catch(() => false)

                return {
                    ...app,
                    pending: !exists,
                }
            })
        ))
    )
}

export const appToStartOptions = ({ id: appId, name, service }: App): StartOptions => {
    const startOptions: StartOptions = {
        ...service.config,
        name,
        script: path.resolve(path.join(appDir, appId, service.config.entry)),
    }
    delete startOptions["entry"]

    return startOptions
}

export const getApps = () => apps as readonly App[]

export const getApp = (appName: string): App | undefined => apps.find(app => app.name === appName)

export const setAppPending = (app: App, pending: boolean) => (apps.find(internalApp => app.id === internalApp.id)!.pending = pending)
