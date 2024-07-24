import express from "express"
import { getPm, stopApp } from "./pm"
import { ServerConfig } from "@gueterbahnhof/common/ServerConfig"
import { createManagementApi } from "./managementApi"
import * as http from "http"
import { initAppConfigsDb, listAppConfigs } from "./app/appConfigDb"
import { listAppState, updateAppState } from "./app/appState"

function bootApps(appDir: string) {
    return Promise.all(listAppConfigs().map(({ name }) => updateAppState(appDir, name)))
}

async function createExpressApp(serverConfig: ServerConfig, pm: Awaited<ReturnType<typeof getPm>>) {
    const mainApp = express()

    mainApp.use(express.json())

    mainApp.use((req, res, next) => {
        next()
    })

    mainApp.get("/status/:name", (req, res) => {
        pm.describe(req.params.name, (err, processDescriptionList) => res.json(processDescriptionList).end())
    })

    mainApp.get("/apps", (req, res) => {
        res.json(listAppState())
    })

    mainApp.use(await createManagementApi(serverConfig))

    return mainApp
}

function createStopFn(server: http.Server, pm: Awaited<ReturnType<typeof getPm>>) {
    let shuttingDown: boolean

    const stop = async () => {
        if (shuttingDown) {
            return
        }

        console.log("Gracefully shutting down.")
        shuttingDown = true

        await Promise.all([
            new Promise(resolve => server.close(resolve)),
            ...Object.entries(listAppState())
                .filter(([, { state }]) => state === "started")
                .map(entry => {
                    return stopApp(entry[0])
                }),
        ])
        pm.disconnect()
        process.exit(0)
    }

    // graceful exit with termination of pm2 apps
    process.on("SIGTERM", stop)
    process.on("SIGINT", stop)

    return stop
}

export async function createMainServer(serverConfig: ServerConfig) {
    const { port, appDir } = serverConfig

    const pm = await getPm()

    const expressApp = await createExpressApp(serverConfig, pm)

    await initAppConfigsDb(appDir)
    await bootApps(appDir).finally(() => {
        const appStates = Object.values(listAppState())
        const startedApps = appStates.filter(appState => appState.state === "started")
        console.log(`Started ${startedApps.length} of ${appStates.length} apps.`)
    })

    const server = http.createServer()

    server.on("request", expressApp)

    return {
        mainApp: server,
        pm,
        start: () => {
            server.listen(port, () => {
                console.log(`Started mainApp on http://localhost:${port}.`)
            })
        },
        stop: createStopFn(server, pm),
    }
}
