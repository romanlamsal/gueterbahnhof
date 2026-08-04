import { createFileRoute } from "@tanstack/react-router"
import { getAuthController, getDeployController } from "@/runtime/services.ts"

export const Route = createFileRoute("/update/$appName")({
    component: UpdateAppArtifactPage,
    server: {
        handlers: {
            POST({ request, params }) {
                const denied = getAuthController().requireApiKey(request)
                if (denied) {
                    return denied
                }

                return getDeployController().postUpdate(request, params.appName)
            },
        },
    },
})

function UpdateAppArtifactPage() {
    return (
        <form
            encType="multipart/form-data"
            onSubmit={ev => {
                ev.preventDefault()
                fetch("", {
                    method: "POST",
                    body: new FormData(ev.currentTarget),
                })
            }}
        >
            <label>
                Artifact
                <input name={"artifact"} type={"file"} />
            </label>
            <button>Deploy</button>
        </form>
    )
}
