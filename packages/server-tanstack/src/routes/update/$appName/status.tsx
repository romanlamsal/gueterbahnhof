import { createFileRoute } from "@tanstack/react-router"
import { getAuthController, getDeployController } from "@/runtime/services.ts"

export const Route = createFileRoute("/update/$appName/status")({
    server: {
        handlers: {
            GET({ request, params }) {
                // CLI polls with the key header; the UI upload page polls on
                // its session cookie.
                const denied = getAuthController().requireApiKeyOrSession(request)
                if (denied) {
                    return denied
                }

                const deploymentId = new URL(request.url).searchParams.get("deploymentId") ?? undefined

                return getDeployController().getStatus(params.appName, deploymentId)
            },
        },
    },
})
