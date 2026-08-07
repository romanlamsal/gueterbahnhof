import { type PortSource, resolveAppPort } from "./app-port.ts"
import { normalizeHost, type ProxyRouteSource } from "./proxy-route.ts"

// Choosing a Port for an App that declared a Proxy Host and named none itself.
//
// The range sits BELOW the kernel's ephemeral floor on purpose. On Linux the
// local port range is 32768–60999, and IANA's "dynamic" 49152–65535 sits
// entirely inside it — so a port chosen from either competes with the kernel's
// own source-port allocation for outbound connections, including in the window
// between checking a port and binding it. 20000–20999 is below that floor,
// above the commonly squatted application defaults, and clear of Kubernetes
// NodePort's 30000–32767.
export const ASSIGNABLE_PORT_RANGE = { from: 20000, to: 20999 } as const

export type PortRange = { from: number; to: number }

// Assignment is the only thing that ever writes a value the operator did not
// type, so eligibility is deliberately narrow: a declared Proxy Host, and no
// port from either the field or the Env. No App that exists today qualifies.
export const needsAssignedPort = (config: ProxyRouteSource) =>
    normalizeHost(config.proxyHost) !== undefined && resolveAppPort(config) === undefined

// Every port the Fleet has spoken for, however it was said — a declared field
// or a PORT in an Env — plus whatever the caller reserves, which is how
// Gueterbahnhof avoids handing out the port it is listening on itself.
export const claimedPorts = (configs: readonly PortSource[], reserved: readonly number[] = []) => {
    const claimed = new Set<number>(reserved)

    for (const config of configs) {
        const port = resolveAppPort(config)

        if (port !== undefined) {
            claimed.add(port)
        }
    }

    return claimed
}

// Yields the range in order, skipping what is claimed. A generator rather than
// an array so the caller can stop at the first candidate that actually binds,
// without probing the whole range.
export function* candidatePorts(claimed: ReadonlySet<number>, range: PortRange = ASSIGNABLE_PORT_RANGE) {
    for (let port = range.from; port <= range.to; port++) {
        if (!claimed.has(port)) {
            yield port
        }
    }
}
