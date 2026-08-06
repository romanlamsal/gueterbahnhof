import { createFileRoute } from "@tanstack/react-router"
import { guarded } from "@/controllers/guarded.ts"
import { getAppsController } from "@/runtime/services.ts"

export const Route = createFileRoute("/apps")({
    server: {
        handlers: {
            GET: guarded.apiKey(() => getAppsController().getApps()),
        },
    },
})
