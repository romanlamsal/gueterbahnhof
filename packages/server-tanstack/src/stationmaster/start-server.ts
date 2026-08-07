import type { Server } from "node:http"
import { join } from "node:path"
import express, { type RequestHandler } from "express"
import type { ProxyRouteSource } from "@/domain/proxy-route.ts"
import { createServices } from "@/runtime/create-services.ts"
import { bootFleet, shutdownFleet } from "@/runtime/lifecycle.ts"
import { createAppProxy } from "./app-proxy.ts"
import { createRouteTable } from "./route-table.ts"

// The Stationmaster: what owns the running server process (ADR-0006). Given
// settings that are already parsed, it applies the environment the built
// server reads, boots the Fleet, installs the shutdown handlers, assembles
// HTTP and listens. The CLI decides what the settings are; this decides what
// to do with them.
//
// THIS MODULE RUNS OUTSIDE THE NITRO BUNDLE. It imports express and the built
// server output, so nitro must never reach it — building it into its own
// output would be circular. Nothing under routes/, controllers/ or the app
// services may import from this directory. esbuild pulls it into the CLI
// binary instead, exactly as it already pulls runtime/lifecycle.ts (ADR-0004).

const TERMINATION_SIGNALS = ["SIGTERM", "SIGINT"] as const

// A process, narrowed to what starting a server needs. Injectable so that
// signal handling can be asserted without ending the test run.
export type HostProcess = {
    on(signal: string, listener: () => void): unknown
    exit(code?: number): never
}

export type StartServerOptions = {
    appDir: string
    port: number
    apiKey?: string
    serverOutputDir: string

    // Collaborators default to the real thing and are substituted in tests —
    // the idiom applyJournaldPriorityPrefixes({ env, target }) already uses.
    // Real behaviour by default, no test-only code path.
    boot?: (appDir: string, reservedPorts: readonly number[]) => Promise<void>
    shutdown?: (appDir: string) => Promise<void>
    loadMiddleware?: (serverOutputDir: string) => Promise<RequestHandler>
    listAppConfigs?: (appDir: string) => Promise<ProxyRouteSource[]>
    routeTtlMs?: number
    env?: Record<string, string | undefined>
    hostProcess?: HostProcess
}

// Deliberately a computed dynamic import: the built output is an artifact
// beside the CLI at runtime, not something a bundler may resolve statically.
const loadBuiltMiddleware = async (serverOutputDir: string) => {
    const { middleware } = await import(join(serverOutputDir, "server/index.mjs"))

    return middleware as RequestHandler
}

// Our apps go down with us, but the daemon and anything we did not configure
// stay up (ADR-0003).
const installShutdownHandlers = ({
    appDir,
    shutdown,
    hostProcess,
}: Required<Pick<StartServerOptions, "appDir" | "shutdown" | "hostProcess">>) => {
    let shuttingDown = false

    for (const signal of TERMINATION_SIGNALS) {
        hostProcess.on(signal, () => {
            if (shuttingDown) {
                return
            }
            shuttingDown = true

            console.log(`Received ${signal}, stopping the fleet.`)

            shutdown(appDir)
                .catch(error => console.error("Failed to stop the fleet:", error))
                .then(() => hostProcess.exit(0))
        })
    }
}

export const startGueterbahnhofServer = async ({
    appDir,
    port,
    apiKey,
    serverOutputDir,
    boot = bootFleet,
    shutdown = shutdownFleet,
    loadMiddleware = loadBuiltMiddleware,
    listAppConfigs = appDirectory => createServices(appDirectory).configRepository.listAppConfigs(),
    routeTtlMs,
    env = process.env,
    hostProcess = process,
}: StartServerOptions): Promise<Server> => {
    // The built server reads its config from env. PM2_HOME is deliberately
    // left untouched: if the operator set it, both our client and the daemon
    // we spawn inherit it (ADR-0003).
    env.GUETERBAHNHOF_DIR = appDir
    if (apiKey) {
        env.GUETERBAHNHOF_API_KEY = apiKey
    }

    // Boot the fleet before serving: connect the daemon, migrate a legacy
    // config, then recreate every configured app. Failing here must be loud
    // and fatal — a listening server with no apps is worse. The exit code
    // belongs to whoever owns the process, so this reports and rethrows.
    try {
        // Our own port is reserved so no App is ever assigned it.
        await boot(appDir, [port])
    } catch (error) {
        console.error("Boot failed:", error)
        throw error
    }

    installShutdownHandlers({ appDir, shutdown, hostProcess })

    const middleware = await loadMiddleware(serverOutputDir)

    const routeTable = createRouteTable({ listAppConfigs: () => listAppConfigs(appDir), ttlMs: routeTtlMs })
    // Primed before we listen, so the first request is routable rather than
    // falling through while the table warms up.
    await routeTable.prime()
    const appProxy = createAppProxy(routeTable)

    const app = express()
    // The proxy goes first, ahead of the static handler: a proxied App's own
    // favicon.ico and robots.txt must be answered by that App and not from our
    // public directory. A request for a host nobody declared falls straight
    // through to static and then the nitro app, exactly as before.
    app.use(appProxy.middleware)
    app.use(express.static(join(serverOutputDir, "public")))
    app.use(middleware)

    return new Promise<Server>(resolve => {
        const server = app.listen(port, () => {
            console.log(`Started gueterbahnhof on http://localhost:${port}.`)
            resolve(server)
        })

        // Upgrades bypass express entirely, so the proxy has to be subscribed
        // to the server itself or a websocket-first client is never proxied.
        server.on("upgrade", appProxy.upgrade)
    })
}
