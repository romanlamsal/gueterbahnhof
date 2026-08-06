import { describe, expect, it, vi } from "vitest"
import { createAppsController } from "./apps-controller.ts"
import { createEventsController } from "./events-controller.ts"

describe("apps controller: GET /apps", () => {
    it("returns id, name and state per app", async () => {
        const controller = createAppsController({
            appService: {
                listApps: vi.fn(async () => [
                    { config: { id: "id-1", name: "my-app", entry: "index.js", env: {} }, state: "online" as const },
                    { config: { id: "id-2", name: "empty", env: {} }, state: "no-artifact" as const },
                ]),
            },
        })

        const response = await controller.getApps()

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual([
            { id: "id-1", name: "my-app", state: "online" },
            { id: "id-2", name: "empty", state: "no-artifact" },
        ])
    })
})

describe("events controller: SSE stream", () => {
    it("streams app state changes as SSE frames and closes on abort", async () => {
        const listeners: ((appName: string, status: string) => void)[] = []
        const init = vi.fn(async () => undefined)
        const controller = createEventsController({
            appStateEvents: {
                init,
                addListener: (cb, signal) => {
                    listeners.push(cb)
                    signal?.addEventListener("abort", () => {
                        listeners.length = 0
                    })
                },
            },
        })

        const abort = new AbortController()
        const request = new Request("http://localhost/ui/events", { signal: abort.signal })

        const response = controller.getEventStream(request)
        expect(response.headers.get("content-type")).toBe("text/event-stream")
        // the first subscriber opens the daemon's event bus
        expect(init).toHaveBeenCalled()

        const reader = (response.body as ReadableStream<Uint8Array>).getReader()
        const decoder = new TextDecoder()

        const first = await reader.read()
        expect(decoder.decode(first.value)).toContain("retry:")

        listeners[0]?.("my-app", "online")
        const second = await reader.read()
        expect(decoder.decode(second.value)).toBe(`data: {"appName":"my-app","state":"online"}\n\n`)

        abort.abort()
        const done = await reader.read()
        expect(done.done).toBe(true)
    })
})
