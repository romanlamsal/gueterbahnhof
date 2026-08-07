// An App's Port is a declared field of its App Config. It used to be nothing
// but a PORT in the App's Env, which is how every App configured before the
// field existed still says which port it binds — so resolution prefers the
// field and falls back to the Env. That fallback is the whole reason an
// upgrade cannot move an App: an App with a hand-set Env PORT and no field
// resolves to exactly the port it runs on today.

export const MIN_PORT = 1
export const MAX_PORT = 65535

// Env values are strings that may be anything. Only a plain integer inside the
// legal range is a port; everything else is treated as absent, so a typo can
// never become a target we then proxy to.
export const parsePort = (value: string | undefined): number | undefined => {
    if (value === undefined) {
        return undefined
    }

    const trimmed = value.trim()

    if (!/^\d+$/.test(trimmed)) {
        return undefined
    }

    const port = Number(trimmed)

    return port >= MIN_PORT && port <= MAX_PORT ? port : undefined
}

export type PortSource = { port?: number; env?: Record<string, string> }

export const resolveAppPort = ({ port, env }: PortSource) => port ?? parsePort(env?.PORT)

// What the operator should see in the Port field: the resolved value, plus
// whether it is still only inherited from the Env and would be promoted by a
// save.
export const describeAppPort = (source: PortSource) => ({
    port: resolveAppPort(source),
    inherited: source.port === undefined && parsePort(source.env?.PORT) !== undefined,
})
