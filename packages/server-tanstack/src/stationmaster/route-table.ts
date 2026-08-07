import { buildProxyRoutes, type ProxyRoute, type ProxyRouteSource } from "@/domain/proxy-route.ts"

// The routing table is derived from App Configs rather than pushed to, because
// nothing can tell the Stationmaster that a config changed: the UI writes them
// through a different module instance. Re-reading on a short interval bounds
// how long a newly deployed App waits to become routable, without any
// invalidation signal existing at all.
//
// Lookups are synchronous on purpose. Every request does one, including every
// asset of every proxied page, so it reads the last snapshot and refreshes in
// the background rather than making the request wait.

export const DEFAULT_ROUTE_TTL_MS = 5_000

export type RouteTable = {
    prime(): Promise<void>
    current(): ReadonlyMap<string, ProxyRoute>
}

export const createRouteTable = ({
    listAppConfigs,
    ttlMs = DEFAULT_ROUTE_TTL_MS,
    now = Date.now,
}: {
    listAppConfigs: () => Promise<ProxyRouteSource[]>
    ttlMs?: number
    now?: () => number
}): RouteTable => {
    let routes: ReadonlyMap<string, ProxyRoute> = new Map()
    let loadedAt = Number.NEGATIVE_INFINITY
    let inFlight: Promise<void> | undefined

    const refresh = () => {
        // One refresh at a time: a burst of requests on a stale table must not
        // turn into a burst of directory reads.
        inFlight ??= listAppConfigs()
            .then(configs => {
                routes = buildProxyRoutes(configs)
                loadedAt = now()
            })
            .catch(error => {
                // Keep serving the last good table rather than dropping every
                // route because one read failed.
                console.error("Could not refresh the proxy routes:", error)
            })
            .finally(() => {
                inFlight = undefined
            })

        return inFlight
    }

    return {
        // Primed before the server listens, so the very first request is
        // routable rather than falling through while the table warms up.
        prime: refresh,

        current() {
            if (now() - loadedAt >= ttlMs) {
                void refresh()
            }

            return routes
        },
    }
}
