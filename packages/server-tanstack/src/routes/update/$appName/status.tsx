import { createFileRoute } from "@tanstack/react-router"
import { getDeployController } from "@/runtime/services.ts"

export const Route = createFileRoute("/update/$appName/status")({
    server: {
        handlers: {
            GET({ params }) {
                return getDeployController().getStatus(params.appName)
            },
        },
    },
})
