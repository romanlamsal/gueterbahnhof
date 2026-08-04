import pm2, { type Proc } from "pm2"
import { z } from "zod"
import { createTypedEventEmitter } from "@/kit/typed-event-emitter.ts"

const AppStateDataSchema = z.object({
    appName: z.string(),
    status: z.enum(["online", "stopped", "pending"]).default("pending"),
})

const AppStateEventSchema = AppStateDataSchema.extend({
    type: z.literal("update-status"),
})

const appStatus = new Map<string, string>()

const eventEmitter = createTypedEventEmitter(AppStateEventSchema)

export const appStateService = {
    init() {
        pm2.launchBus((err, pm2Bus) => {
            if (err) {
                return console.log("Error opening bus:", err)
            }

            pm2Bus.on("process:event", (event: { event: string; process: Proc }) => {
                const status = event.process.status
                const appName = event.process.name

                const { data: appStateEvent } = AppStateEventSchema.safeParse({
                    type: "update-status",
                    appName: appName,
                    status,
                })

                if (
                    !appStateEvent ||
                    appStatus.get(appStateEvent.appName) === appStateEvent.status
                ) {
                    return
                }

                appStatus.set(appStateEvent.appName, appStateEvent.status)
                eventEmitter.emit(appStateEvent)
            })

            /*this.addListener((appName, nextState) =>
                console.log(`[AppState] ${appName}: ${nextState}`),
            )*/
        })
    },

    addListener(cb: (appName: string, nextState: string) => void, signal?: AbortSignal) {
        eventEmitter.on(
            "update-status",
            ({ appName, status }) => {
                cb(appName, status)
            },
            signal,
        )
    },
}
