import type { appStateService } from "@/interface-services/app-state-service.ts"

// Streams app state changes as server-sent events. The payload is a trigger,
// not a source of truth — clients refetch the app list on every event.
export const createEventsController = ({
    appStateEvents,
}: {
    appStateEvents: Pick<typeof appStateService, "addListener" | "init">
}) => ({
    getEventStream(request: Request): Response {
        // First subscriber opens the daemon's event bus; idempotent thereafter.
        appStateEvents.init()

        const abortController = new AbortController()
        request.signal.addEventListener("abort", () => abortController.abort())

        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                const encoder = new TextEncoder()

                controller.enqueue(encoder.encode("retry: 3000\n\n"))

                appStateEvents.addListener((appName, state) => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ appName, state })}\n\n`))
                    } catch {
                        abortController.abort()
                    }
                }, abortController.signal)

                abortController.signal.addEventListener("abort", () => {
                    try {
                        controller.close()
                    } catch {
                        // already closed
                    }
                })
            },
            cancel() {
                abortController.abort()
            },
        })

        return new Response(stream, {
            headers: {
                "content-type": "text/event-stream",
                "cache-control": "no-cache",
                connection: "keep-alive",
            },
        })
    },
})

export type EventsController = ReturnType<typeof createEventsController>
