import pm2 from "pm2"
import { z } from "zod"
import { connectProcessManager } from "./pm2-process-manager.ts"
import type { ProcessEvents, ProcessStateChange } from "./process-events.ts"

// pm2's bus payload is whatever pm2 decides to send, so this is the one place
// worth validating — everything downstream receives a ProcessStateChange.
const Pm2ProcessEventSchema = z.object({
    process: z.object({
        name: z.string(),
        status: z.string().default("pending"),
    }),
})

export const pm2ProcessEvents: ProcessEvents = {
    async subscribe(onChange) {
        await connectProcessManager()

        return new Promise<void>(resolve => {
            pm2.launchBus((err, pm2Bus) => {
                if (err) {
                    console.error("Could not open the pm2 event bus:", err)
                    return resolve()
                }

                pm2Bus.on("process:event", (event: unknown) => {
                    const parsed = Pm2ProcessEventSchema.safeParse(event)

                    if (!parsed.success) {
                        return
                    }

                    const change: ProcessStateChange = {
                        name: parsed.data.process.name,
                        status: parsed.data.process.status,
                    }

                    onChange(change)
                })

                resolve()
            })
        })
    },
}
