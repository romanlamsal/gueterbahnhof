import express from "express"
import { App } from "@gueterbahnhof/common/App"
import vhost from "vhost"
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware"
import { startOrReloadApp } from "./pm"
import { setAppPending } from "./apps"
import http, { ClientRequest } from "http"
import { Request } from "http-proxy-middleware/dist/types"

export const appRouter = express.Router()

const activeRoutes = []

const addXForwardedHost = (proxyReq: ClientRequest, req: Request) => {
    const xForwardedHost = "x-forwarded-host"
    if (!proxyReq.hasHeader(xForwardedHost) && req.hostname) {
        proxyReq.setHeader(xForwardedHost, req.hostname)
    }
}

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
                        try {
                            addXForwardedHost(proxyReq, req)
                        } catch (e) {
                            console.error("Could not set x-forwarded-host header:", e)
                        }
                        fixRequestBody(proxyReq, req)
                    },
                })
            )
        )
    }

    await startOrReloadApp(app).catch(err => console.log("Error starting service:", err))

    setAppPending(app, false)

    return true
}
