import { createFileRoute } from "@tanstack/react-router"
import { guarded } from "@/controllers/guarded.ts"
import { getEventsController } from "@/runtime/services.ts"

export const Route = createFileRoute("/ui/events")({
    server: {
        handlers: {
            GET: guarded.uiSession(({ request }) => getEventsController().getEventStream(request)),
        },
    },
})
