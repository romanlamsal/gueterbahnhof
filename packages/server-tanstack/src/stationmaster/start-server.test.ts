import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import type { Server } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { type HostProcess, type StartServerOptions, startGueterbahnhofServer } from "./start-server.ts"

// The Stationmaster is asserted through real HTTP, so the tests prove bytes
// arrive rather than that a function was called. Nothing here runs a process
// manager or loads a production build: the fleet lifecycle and the middleware
// loader are substituted through their defaulted parameters.

const servers: Server[] = []
const outputDirs: string[] = []

afterEach(async () => {
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
        env: {},
        hostProcess: fakeHostProcess().hostProcess,
        ...overrides,
    })

    servers.push(server)

    return server
}

const portOf = (server: Server) => {
    const address = server.address()

    if (!address || typeof address === "string") {
        throw new Error("expected a TCP address")
    }

    return address.port
}

const get = (server: Server, path: string) => fetch(`http://127.0.0.1:${portOf(server)}${path}`)

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
        await expect(get(server, "/probe.txt").then(response => response.text())).resolves.toBe("STATIC")
    })

    it("hands everything else to the nitro app", async () => {
        const server = await start()

        await expect(get(server, "/ui").then(response => response.text())).resolves.toBe("MIDDLEWARE")
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
