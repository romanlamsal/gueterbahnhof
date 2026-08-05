import pm2, { type Proc } from "pm2"
import { z } from "zod"
import { createTypedEventEmitter } from "@/kit/typed-event-emitter.ts"

const AppStateEventSchema = z.object({
    type: z.literal("update-state"),
    appName: z.string(),
    // Raw pm2 process state — consumers treat events as refetch triggers, so
    // any state string is worth forwarding.
    state: z.string().default("pending"),
})

const lastKnownState = new Map<string, string>()

const eventEmitter = createTypedEventEmitter(AppStateEventSchema)

export const appStateService = {
    init() {
        pm2.launchBus((err, pm2Bus) => {
            if (err) {
                return console.log("Error opening bus:", err)
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
        })
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
