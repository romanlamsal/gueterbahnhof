import { createFileRoute } from "@tanstack/react-router"
import { getAppsController, getAuthController } from "@/runtime/services.ts"

export const Route = createFileRoute("/apps")({
    server: {
        handlers: {
            GET({ request }) {
                const denied = getAuthController().requireApiKey(request)
                if (denied) {
                    return denied
                }

                return getAppsController().getApps()
            },
        },
    },
})
