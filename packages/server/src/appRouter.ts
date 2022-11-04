import express from "express"
import { App } from "@gueterbahnhof/common/App"
import vhost from "vhost"
import { createProxyMiddleware } from "http-proxy-middleware"
import { startOrReloadApp } from "./pm"
import { setAppPending } from "./apps"

export const appRouter = express.Router()

const activeRoutes = []

export async function addAppRoute(app: App) {
    const { service } = app

    if (!activeRoutes.includes(app.id)) {
        activeRoutes.push(app.id)
        appRouter.use(
            vhost(
                service.hostname,
                createProxyMiddleware({
                    target: service.target,
                    changeOrigin: true,
                    ws: true,
                })
            )
        )
    }

    await startOrReloadApp(app).catch(err => console.log("Error starting service:", err))

    setAppPending(app, false)

    return true
}
