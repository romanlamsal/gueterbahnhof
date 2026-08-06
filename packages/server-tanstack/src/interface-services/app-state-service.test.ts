import { describe, expect, it, vi } from "vitest"
import { createAppStateBus } from "./app-state-service.ts"
import type { ProcessEvents, ProcessStateChange } from "./process-events.ts"

// The fake is three lines because the port speaks App names and statuses; with
// pm2's bus injected directly it would have had to impersonate pm2.
const fakeProcessEvents = () => {
    let emit: (change: ProcessStateChange) => void = () => undefined

    const processEvents: ProcessEvents = {
        subscribe: vi.fn(async onChange => {
            emit = onChange
        }),
    }

    return { processEvents, emit: (change: ProcessStateChange) => emit(change) }
}

describe("createAppStateBus", () => {
    it("forwards a state change to its listeners", async () => {
        const { processEvents, emit } = fakeProcessEvents()
        const bus = createAppStateBus({ processEvents })
        const heard = vi.fn()

        bus.addListener(heard)
        await bus.init()
        emit({ name: "my-app", status: "online" })

        expect(heard).toHaveBeenCalledWith("my-app", "online")
    })

    it("subscribes once however many times init is called", async () => {
        const { processEvents } = fakeProcessEvents()
        const bus = createAppStateBus({ processEvents })

        await Promise.all([bus.init(), bus.init(), bus.init()])

        expect(processEvents.subscribe).toHaveBeenCalledTimes(1)
    })

    it("suppresses repeats of a state it already reported", async () => {
        const { processEvents, emit } = fakeProcessEvents()
        const bus = createAppStateBus({ processEvents })
        const heard = vi.fn()

        bus.addListener(heard)
        await bus.init()
        emit({ name: "my-app", status: "online" })
        emit({ name: "my-app", status: "online" })
        emit({ name: "my-app", status: "stopped" })

        expect(heard.mock.calls).toEqual([
            ["my-app", "online"],
            ["my-app", "stopped"],
        ])
    })

    it("tracks apps independently", async () => {
        const { processEvents, emit } = fakeProcessEvents()
        const bus = createAppStateBus({ processEvents })
        const heard = vi.fn()

        bus.addListener(heard)
        await bus.init()
        emit({ name: "one", status: "online" })
        emit({ name: "two", status: "online" })

        expect(heard).toHaveBeenCalledTimes(2)
    })

    it("stops delivering once a listener's signal aborts", async () => {
        const { processEvents, emit } = fakeProcessEvents()
        const bus = createAppStateBus({ processEvents })
        const heard = vi.fn()
        const abort = new AbortController()

        bus.addListener(heard, abort.signal)
        await bus.init()
        emit({ name: "my-app", status: "online" })
        abort.abort()
        emit({ name: "my-app", status: "stopped" })

        expect(heard).toHaveBeenCalledTimes(1)
    })

    it("allows a retry when the subscription failed", async () => {
        const processEvents: ProcessEvents = {
            subscribe: vi.fn().mockRejectedValueOnce(new Error("no daemon")).mockResolvedValueOnce(undefined),
        }
        const bus = createAppStateBus({ processEvents })

        await bus.init()
        await bus.init()

        expect(processEvents.subscribe).toHaveBeenCalledTimes(2)
    })
})
