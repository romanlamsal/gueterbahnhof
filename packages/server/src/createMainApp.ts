import express from "express"
import { getPm, stopApp } from "./pm"
import { ServerConfig } from "@gueterbahnhof/common/ServerConfig"
import { getApps, loadApps } from "./apps"
import { createManagementApi } from "./managementApi"
import { addAppRoute, appRouter } from "./appRouter"
import vhost from "vhost"
import { createHttpsServer } from "./createHttpsServer"
import * as http from "http"

export async function createMainApp(serverConfig: ServerConfig) {
    const { port, appDir, hostname, tlsCert, tlsKey } = serverConfig

    const mainApp = express()

    mainApp.use(express.json())

    mainApp.use((req, res, next) => {
        next()
    })

    const [pm] = await Promise.all([getPm(), loadApps(appDir)])

    const startedApps = await Promise.all(
        getApps().map(app => {
            const { name, pending } = app

            if (pending) {
                console.log(`Pending app '${name}'.`)
                return
            }

            return addAppRoute(app)
        })
    )

    console.log(`Started ${startedApps.filter(Boolean).length} apps.`)

    mainApp.get("/status/:name", (req, res) => {
        pm.describe(req.params.name, (err, processDescriptionList) => res.json(processDescriptionList).end())
    })

    mainApp.get("/apps", (req, res) => {
        res.json(getApps())
    })

    if (hostname) {
        mainApp.use(vhost(hostname, await createManagementApi(serverConfig)))
    } else {
        mainApp.use(await createManagementApi(serverConfig))
    }
    mainApp.use(appRouter)

    const isSecure = tlsCert && tlsKey
    const server = isSecure ? createHttpsServer(serverConfig) : http.createServer()

    server.on("request", mainApp)

    let shuttingDown = false

    const stop = async () => {
        if (shuttingDown) {
            return
        }

        console.log("Gracefully shutting down.")
        shuttingDown = true

        await Promise.all([
            new Promise(resolve => server.close(resolve)),
            ...getApps()
                .filter(app => !app.pending)
                .map(stopApp),
        ])
        pm.disconnect()
        process.exit(0)
    }

    // graceful exit with termination of pm2 apps
    process.on("SIGTERM", stop)
    process.on("SIGINT", stop)

    return {
        mainApp: server,
        pm,
        start: () => {
            const startServerCb = () => {
                const protocol = isSecure ? "https" : "http"
                const host = hostname || "localhost"
                const portStr = (isSecure && port.toString() === "443") || (!isSecure && port.toString() === "80") ? "" : ":" + port
                console.log(`Started mainApp on ${protocol}://${host}${portStr}.`)
            }

            // http.createServer(mainApp).listen(3000, () => console.log(`ALSO on http://${hostname || "localhost"}:3000`))
            server.listen(port, startServerCb)
        },
        stop,
    }
}
