import type { IncomingMessage, ServerResponse } from "node:http"
import type { RequestHandler } from "express"
import { createProxyMiddleware } from "http-proxy-middleware"
import { findProxyRoute, type ProxyRoute, proxyTargetOf } from "@/domain/proxy-route.ts"
import type { RouteTable } from "./route-table.ts"

// Host-based reverse proxying for the Fleet's own Apps.
//
// THIS MODULE RUNS OUTSIDE THE NITRO BUNDLE — see start-server.ts.

const headerReader = (request: IncomingMessage) => (name: string) => {
    const value = request.headers[name]

    return Array.isArray(value) ? value[0] : value
}

export const routeFor = (request: IncomingMessage, table: RouteTable) =>
    findProxyRoute(headerReader(request), table.current())

const notRunning = (route: ProxyRoute, response: ServerResponse) => {
    if (response.headersSent) {
        response.destroy()
        return
    }

    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
    response.end(`App '${route.appName}' is not answering on port ${route.port}.\n`)
}

export const createAppProxy = (table: RouteTable) => {
    const proxy = createProxyMiddleware({
        // Apps are served at the root of their own hostname, so nothing is
        // rewritten: no path, no cookie domain, no Host.
        changeOrigin: false,
        ws: true,
        xfwd: true,
        // Resolved per request, and never from the response — that argument is
        // absent during a websocket upgrade.
        router: request => {
            const route = routeFor(request, table)

            return route === undefined ? undefined : proxyTargetOf(route)
        },
        on: {
            error: (error, request, response) => {
                const route = routeFor(request, table)

                // A stopped App refuses the connection. That refusal IS the
                // liveness check — always current, and nothing has to ask the
                // process manager anything on the request path.
                if (route && "writeHead" in response) {
                    console.warn(`Proxy error for '${route.appName}':`, error.message)
                    return notRunning(route, response)
                }

                // An upgrade failure has a socket rather than a response.
                if ("destroy" in response) {
                    response.destroy()
                }
            },
        },
    })

    return {
        // Only requests for a declared host are proxied; everything else falls
        // through to the static handler and then the Management API, exactly as
        // before this existed.
        middleware: ((request, response, next) => {
            if (routeFor(request, table) === undefined) {
                return next()
            }

            return proxy(request, response, next)
        }) as RequestHandler,

        // Websocket upgrades never reach express middleware, so the server has
        // to hand them over explicitly. Without this, a client whose first
        // contact is the upgrade would not be proxied at all.
        upgrade: proxy.upgrade,
    }
}
