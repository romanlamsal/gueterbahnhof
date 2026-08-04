import { createFileRoute } from "@tanstack/react-router"
import { getAuthController, getDeployController } from "@/runtime/services.ts"

export const Route = createFileRoute("/update/$appName/status")({
    server: {
        handlers: {
            GET({ request, params }) {
                const denied = getAuthController().requireApiKey(request)
                if (denied) {
                    return denied
                }

                return getDeployController().getStatus(params.appName)
            },
        },
    },
})
