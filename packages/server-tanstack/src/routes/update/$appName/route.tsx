import { createFileRoute, redirect } from "@tanstack/react-router"
import { getSessionStatusFunc } from "@/routes/ui/-lib/auth-funcs.ts"
import { getAuthController, getDeployController } from "@/runtime/services.ts"

export const Route = createFileRoute("/update/$appName")({
    component: UpdateAppArtifactPage,
    beforeLoad: async ({ location }) => {
        const { authed } = await getSessionStatusFunc()

        if (!authed) {
            throw redirect({ to: "/login", search: { redirect: location.href } })
        }
    },
    server: {
        handlers: {
            POST({ request, params }) {
                // CLI deploys send the key header; the upload form below rides
                // on the UI session cookie.
                const denied = getAuthController().requireApiKeyOrSession(request)
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
