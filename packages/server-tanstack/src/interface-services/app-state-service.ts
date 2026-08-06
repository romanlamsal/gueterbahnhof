import { EventEmitter } from "node:events"
import type { ProcessEvents } from "./process-events.ts"

// Broadcasts App State changes to whoever is listening — today the SSE stream.
// A factory rather than a singleton, so its subscription and its memory of the
// last known state live in a closure a test can create fresh.

export type AppStateBus = {
    /** Opens the subscription; idempotent, so the first listener can call it. */
    init(): Promise<void>
    addListener(cb: (appName: string, nextState: string) => void, signal?: AbortSignal): void
}

const STATE_CHANGED = "state-changed"

export const createAppStateBus = ({ processEvents }: { processEvents: ProcessEvents }): AppStateBus => {
    const emitter = new EventEmitter()
    const lastKnownState = new Map<string, string>()
    let subscription: Promise<void> | undefined

    return {
        init() {
            subscription ??= processEvents
                .subscribe(({ name, status }) => {
                    // Only genuine changes are worth waking the UI for.
                    if (lastKnownState.get(name) === status) {
                        return
                    }

                    lastKnownState.set(name, status)
                    emitter.emit(STATE_CHANGED, name, status)
                })
                .catch(error => {
                    subscription = undefined
                    console.error("Could not subscribe to process events:", error)
                })

            return subscription
        },

        addListener(cb, signal) {
            emitter.on(STATE_CHANGED, cb)

            signal?.addEventListener("abort", () => emitter.off(STATE_CHANGED, cb))
        },
    }
}
