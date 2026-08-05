import { createFileRoute } from "@tanstack/react-router"
import { getAuthController, getEventsController } from "@/runtime/services.ts"

export const Route = createFileRoute("/ui/events")({
    server: {
        handlers: {
            GET({ request }) {
                const denied = getAuthController().requireUiSession(request)
                if (denied) {
                    return denied
                }

                return getEventsController().getEventStream(request)
            },
        },
    },
})
