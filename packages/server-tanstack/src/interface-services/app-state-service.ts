import pm2, { type Proc } from "pm2"
import { z } from "zod"
import { createTypedEventEmitter } from "@/kit/typed-event-emitter.ts"
import { connectProcessManager } from "./pm2-process-manager.ts"

const AppStateEventSchema = z.object({
    type: z.literal("update-state"),
    appName: z.string(),
    // Raw pm2 process state — consumers treat events as refetch triggers, so
    // any state string is worth forwarding.
    state: z.string().default("pending"),
})

const lastKnownState = new Map<string, string>()

const eventEmitter = createTypedEventEmitter(AppStateEventSchema)

// Subscribing to the daemon's bus is lazy and idempotent: the first SSE client
// triggers it, since nothing else needs it (ADR-0003).
let busSubscription: Promise<void> | undefined

const subscribeToBus = async () => {
    await connectProcessManager()

    return new Promise<void>(resolve => {
        pm2.launchBus((err, pm2Bus) => {
            if (err) {
                console.log("Error opening bus:", err)
                return resolve()
            }

            pm2Bus.on("process:event", (event: { event: string; process: Proc }) => {
                const { data: appStateEvent } = AppStateEventSchema.safeParse({
                    type: "update-state",
                    appName: event.process.name,
                    state: event.process.status,
                })

                if (!appStateEvent || lastKnownState.get(appStateEvent.appName) === appStateEvent.state) {
                    return
                }

                lastKnownState.set(appStateEvent.appName, appStateEvent.state)
                eventEmitter.emit(appStateEvent)
            })

            resolve()
        })
    })
}

export const appStateService = {
    init() {
        busSubscription ??= subscribeToBus().catch(error => {
            busSubscription = undefined
            console.error("Could not subscribe to the pm2 event bus:", error)
        })

        return busSubscription
    },

    addListener(cb: (appName: string, nextState: string) => void, signal?: AbortSignal) {
        eventEmitter.on(
            "update-state",
            ({ appName, state }) => {
                cb(appName, state)
            },
            signal,
        )
    },
}
