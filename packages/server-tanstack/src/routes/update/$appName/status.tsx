import { createFileRoute } from "@tanstack/react-router"
import { guarded } from "@/controllers/guarded.ts"
import { getDeployController } from "@/runtime/services.ts"

export const Route = createFileRoute("/update/$appName/status")({
    server: {
        handlers: {
            // The CLI polls with the key header; the UI upload page polls on
            // its session cookie.
            GET: guarded.apiKeyOrSession(({ request, params }) => {
                const deploymentId = new URL(request.url).searchParams.get("deploymentId") ?? undefined

                return getDeployController().getStatus(params.appName, deploymentId)
            }),
        },
    },
})
