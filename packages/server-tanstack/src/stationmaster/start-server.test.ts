import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer, request as httpRequest, type Server } from "node:http"
import { connect, type Socket } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { type HostProcess, type StartServerOptions, startGueterbahnhofServer } from "./start-server.ts"

// The Stationmaster is asserted through real HTTP, so the tests prove bytes
// arrive rather than that a function was called. Nothing here runs a process
// manager or loads a production build: the fleet lifecycle and the middleware
// loader are substituted through their defaulted parameters.

const servers: Server[] = []
const sockets: Socket[] = []
const outputDirs: string[] = []

// Every accepted socket is remembered, because an upgraded one is detached
// from its server's connection tracking — closeAllConnections cannot reach it,
// and close() then never calls back.
const remember = <T extends Server>(server: T) => {
    server.on("connection", socket => sockets.push(socket))
    servers.push(server)
    return server
}

afterEach(async () => {
    for (const socket of sockets.splice(0)) {
        socket.destroy()
    }

    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
    await Promise.all(outputDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
    vi.restoreAllMocks()
})

// A stand-in for the built server output: a public directory with one asset,
// so "static is registered ahead of the nitro app" is observable as a response.
const makeServerOutput = async () => {
    const dir = await mkdtemp(join(tmpdir(), "gbh-stationmaster-"))
    outputDirs.push(dir)

    await mkdir(join(dir, "public"), { recursive: true })
    await writeFile(join(dir, "public", "probe.txt"), "STATIC")

    return dir
}

const fakeHostProcess = () => {
    const handlers = new Map<string, () => void>()

    const hostProcess: HostProcess = {
        on: (signal, listener) => handlers.set(signal, listener),
        exit: vi.fn() as unknown as HostProcess["exit"],
    }

    return { hostProcess, handlers, exit: hostProcess.exit as unknown as ReturnType<typeof vi.fn> }
}

const start = async (overrides: Partial<StartServerOptions> = {}) => {
    const serverOutputDir = overrides.serverOutputDir ?? (await makeServerOutput())

    const server = await startGueterbahnhofServer({
        appDir: "/tmp/does-not-need-to-exist",
        port: 0,
        serverOutputDir,
        boot: async () => undefined,
        shutdown: async () => undefined,
        loadMiddleware: async () => (_req, res) => res.end("MIDDLEWARE"),
        listAppConfigs: async () => [],
        env: {},
        hostProcess: fakeHostProcess().hostProcess,
        ...overrides,
    })

    remember(server)

    return server
}

// A stand-in for a running App: a real server on a real port, so the proxy
// tests prove bytes arrive rather than that a proxy was configured.
const startUpstream = async (handler: (path: string) => string = path => `UPSTREAM ${path}`) => {
    const upstream = createServer((req, res) => res.end(handler(req.url ?? "/")))
    await new Promise<void>(resolve => upstream.listen(0, resolve))
    remember(upstream)

    return portOf(upstream)
}

const portOf = (server: Server) => {
    const address = server.address()

    if (!address || typeof address === "string") {
        throw new Error("expected a TCP address")
    }

    return address.port
}

// node:http rather than fetch, because fetch forbids setting Host — and Host is
// exactly what routing is decided on.
const get = (server: Server, path: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
        const request = httpRequest({ host: "127.0.0.1", port: portOf(server), path, headers }, response => {
            let body = ""
            response.setEncoding("utf8")
            response.on("data", chunk => {
                body += chunk
            })
            response.on("end", () => resolve({ status: response.statusCode ?? 0, body }))
        })

        request.on("error", reject)
        request.end()
    })

describe("startGueterbahnhofServer", () => {
    it("boots the fleet before it listens", async () => {
        const order: string[] = []

        const server = await start({
            boot: async () => {
                order.push("boot")
            },
        })

        // Listening is only true once the returned promise resolves, so a boot
        // recorded before that is a boot that finished first.
        expect(order).toEqual(["boot"])
        expect(server.listening).toBe(true)
    })

    it("does not listen when the fleet fails to boot, and says so", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
        const listened = vi.fn()

        await expect(
            start({
                boot: async () => {
                    throw new Error("daemon unreachable")
                },
                loadMiddleware: async () => {
                    listened()
                    return (_req, res) => res.end()
                },
            }),
        ).rejects.toThrow("daemon unreachable")

        // Nothing past boot may run: no middleware loaded, so no socket opened.
        expect(listened).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledWith("Boot failed:", expect.any(Error))
    })

    it("serves static assets ahead of the nitro app", async () => {
        const server = await start()

        // If the order were reversed the nitro app would answer this too.
        await expect(get(server, "/probe.txt").then(response => response.body)).resolves.toBe("STATIC")
    })

    it("hands everything else to the nitro app", async () => {
        const server = await start()

        await expect(get(server, "/ui").then(response => response.body)).resolves.toBe("MIDDLEWARE")
    })

    it("listens on the configured port", async () => {
        // Borrow a free port from the OS, release it, then demand exactly it.
        const scout = await start()
        const port = portOf(scout)
        await new Promise(resolve => scout.close(resolve))

        const server = await start({ port })

        expect(portOf(server)).toBe(port)
    })

    it("puts the app directory and api key into the env the built server reads", async () => {
        const env: Record<string, string | undefined> = {}

        await start({ appDir: "/srv/apps", apiKey: "s3cret", env })

        expect(env.GUETERBAHNHOF_DIR).toBe("/srv/apps")
        expect(env.GUETERBAHNHOF_API_KEY).toBe("s3cret")
    })

    it("leaves the api key unset when none was given", async () => {
        const env: Record<string, string | undefined> = {}

        await start({ appDir: "/srv/apps", apiKey: "", env })

        expect(env.GUETERBAHNHOF_DIR).toBe("/srv/apps")
        expect("GUETERBAHNHOF_API_KEY" in env).toBe(false)
    })

    it("stops the fleet once on a termination signal and ignores the second", async () => {
        vi.spyOn(console, "log").mockImplementation(() => undefined)
        const { hostProcess, handlers, exit } = fakeHostProcess()
        const shutdown = vi.fn(async () => undefined)

        await start({ shutdown, hostProcess })

        handlers.get("SIGTERM")?.()
        handlers.get("SIGINT")?.()
        await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))

        expect(shutdown).toHaveBeenCalledTimes(1)
    })

    it("installs a handler for both termination signals", async () => {
        const { hostProcess, handlers } = fakeHostProcess()

        await start({ hostProcess })

        expect([...handlers.keys()].sort()).toEqual(["SIGINT", "SIGTERM"])
    })
})

describe("proxying to an App by its Proxy Host", () => {
    const proxied = async (extra: Partial<StartServerOptions> = {}) => {
        const upstreamPort = await startUpstream()

        const server = await start({
            listAppConfigs: async () => [{ name: "api", proxyHost: "api.example.com", port: upstreamPort }],
            ...extra,
        })

        return { server, upstreamPort }
    }

    it("answers a request for a declared host from the App", async () => {
        const { server } = await proxied()

        const response = await get(server, "/things", { host: "api.example.com" })

        expect(response.body).toBe("UPSTREAM /things")
    })

    it("prefers the forwarded host, so an edge proxy can front us", async () => {
        const { server } = await proxied()

        const response = await get(server, "/things", { "x-forwarded-host": "api.example.com" })

        expect(response.body).toBe("UPSTREAM /things")
    })

    it("falls through to the Management API for a host nobody declared", async () => {
        const { server } = await proxied()

        const response = await get(server, "/ui", { host: "gbh.example.com" })

        expect(response.body).toBe("MIDDLEWARE")
    })

    it("lets the App answer a path that also exists in our public directory", async () => {
        const { server } = await proxied()

        // Reversed order would serve gueterbahnhof's own file here, silently
        // branding every proxied site.
        const response = await get(server, "/probe.txt", { host: "api.example.com" })

        expect(response.body).toBe("UPSTREAM /probe.txt")
    })

    it("still serves our own static assets on an unmatched host", async () => {
        const { server } = await proxied()

        await expect(get(server, "/probe.txt").then(response => response.body)).resolves.toBe("STATIC")
    })

    it("returns a 502 naming the App when nothing is listening for it", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined)
        const deadPort = await startUpstream()
        // Free the port again so the connection is refused rather than answered.
        await new Promise(resolve => servers.pop()?.close(resolve))

        const server = await start({
            listAppConfigs: async () => [{ name: "api", proxyHost: "api.example.com", port: deadPort }],
        })

        const response = await get(server, "/", { host: "api.example.com" })

        expect(response.status).toBe(502)
        expect(response.body).toContain("api")
    })

    it("tunnels a websocket upgrade whose connection never made an ordinary request first", async () => {
        // Upgrades bypass express entirely, so this fails outright unless the
        // proxy is subscribed to the server's own upgrade event. The frames
        // themselves are the library's business; what matters here is that the
        // handshake reaches the App at all.
        const upstream = createServer()
        upstream.on("upgrade", (_req, socket) => {
            socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n")
        })
        await new Promise<void>(resolve => upstream.listen(0, resolve))
        remember(upstream)

        const server = await start({
            listAppConfigs: async () => [{ name: "api", proxyHost: "api.example.com", port: portOf(upstream) }],
        })

        const handshake = await new Promise<string>((resolve, reject) => {
            const socket = connect(portOf(server), "127.0.0.1", () => {
                sockets.push(socket)
                socket.write(
                    "GET /socket HTTP/1.1\r\nHost: api.example.com\r\nUpgrade: websocket\r\n" +
                        "Connection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
                )
            })
            socket.setEncoding("utf8")
            socket.once("data", chunk => {
                socket.destroy()
                resolve(String(chunk))
            })
            socket.once("error", reject)
        })

        expect(handshake).toContain("101 Switching Protocols")
    })

    it("routes a newly declared App once the table refreshes", async () => {
        const upstreamPort = await startUpstream()
        let configs: { name: string; proxyHost?: string; port?: number }[] = []

        const server = await start({ listAppConfigs: async () => configs, routeTtlMs: 0 })

        await expect(get(server, "/", { host: "api.example.com" }).then(r => r.body)).resolves.toBe("MIDDLEWARE")

        configs = [{ name: "api", proxyHost: "api.example.com", port: upstreamPort }]
        // One request to trigger the refresh, then the next one sees it.
        await get(server, "/", { host: "api.example.com" })

        await vi.waitFor(async () =>
            expect((await get(server, "/", { host: "api.example.com" })).body).toBe("UPSTREAM /"),
        )
    })
})
