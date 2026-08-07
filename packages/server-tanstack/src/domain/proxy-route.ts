import { type PortSource, resolveAppPort } from "./app-port.ts"

// Which App, if any, a request is for. An App is reachable exactly when it
// declares a Proxy Host — no server-level flag, and no App that exists today
// declares one, so the whole feature is inert until someone opts in.

export type ProxyRoute = { appName: string; port: number }

export type ProxyRouteSource = PortSource & { name: string; proxyHost?: string }

// Hosts arrive with a port attached, in mixed case, and occasionally with the
// DNS root dot. Match on what they all mean rather than on how they were
// written.
export const normalizeHost = (value: string | undefined) => {
    if (!value) {
        return undefined
    }

    // X-Forwarded-Host is a list when more than one proxy has handled the
    // request; the first entry is the one the client asked for.
    const first = value.split(",")[0]?.trim().toLowerCase()

    if (!first) {
        return undefined
    }

    // Strip a port, but not the colons of an IPv6 literal.
    const withoutPort = first.startsWith("[") ? first : first.replace(/:\d+$/, "")
    const withoutRootDot = withoutPort.replace(/\.$/, "")

    return withoutRootDot || undefined
}

// The forwarded header wins so that Gueterbahnhof works as the inner hop
// behind an existing edge proxy, which is what makes migrating one App at a
// time possible.
export const requestHost = (getHeader: (name: string) => string | undefined) =>
    normalizeHost(getHeader("x-forwarded-host")) ?? normalizeHost(getHeader("host"))

// An App needs both halves to be reachable: a host to be found by, and a port
// to be reached at. Declaring a host but resolving to no port means the App is
// not routable yet — ticket 03 is what fills that in.
export const buildProxyRoutes = (configs: readonly ProxyRouteSource[]) => {
    const routes = new Map<string, ProxyRoute>()

    for (const config of configs) {
        const host = normalizeHost(config.proxyHost)
        const port = resolveAppPort(config)

        // First declaration wins, so a duplicated host resolves the same way
        // on every boot instead of depending on directory order.
        if (host === undefined || port === undefined || routes.has(host)) {
            continue
        }

        routes.set(host, { appName: config.name, port })
    }

    return routes
}

export const findProxyRoute = (
    getHeader: (name: string) => string | undefined,
    routes: ReadonlyMap<string, ProxyRoute>,
) => {
    const host = requestHost(getHeader)

    return host === undefined ? undefined : routes.get(host)
}

// Always absolute, always loopback. The proxy helper treats a target that
// begins with a path separator as an internal sub-request that never leaves
// the process, so a half-built target would silently re-enter our own app.
export const proxyTargetOf = ({ port }: ProxyRoute) => `http://127.0.0.1:${port}`
