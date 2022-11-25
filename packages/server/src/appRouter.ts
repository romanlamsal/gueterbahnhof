import express from "express"
import { App } from "@gueterbahnhof/common/App"
import vhost from "vhost"
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware"
import { startOrReloadApp } from "./pm"
import { setAppPending } from "./apps"
import http from "http"
import { Request } from "http-proxy-middleware/dist/types"

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
                    onProxyReq(proxyReq: http.ClientRequest, req: Request) {
                        fixRequestBody(proxyReq, req)
                        const xForwardedHost = "x-forwarded-host"
                        if (!proxyReq.hasHeader(xForwardedHost)) {
                            proxyReq.setHeader(xForwardedHost, req.host)
                        }
                    },
                })
            )
        )
    }

    await startOrReloadApp(app).catch(err => console.log("Error starting service:", err))

    setAppPending(app, false)

    return true
}
