import { createFileRoute, redirect } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
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

type DeploymentProgress =
    | { phase: "idle" }
    | { phase: "uploading" }
    | { phase: "polling"; deploymentId: string; state: string }
    | { phase: "done"; state: string; reason?: string }
    | { phase: "error"; message: string }

function UpdateAppArtifactPage() {
    const { appName } = Route.useParams()
    const [progress, setProgress] = useState<DeploymentProgress>({ phase: "idle" })
    const pollTimer = useRef<ReturnType<typeof setInterval>>(undefined)

    const pollStatus = (deploymentId: string) => {
        clearInterval(pollTimer.current)

        pollTimer.current = setInterval(async () => {
            const response = await fetch(
                `/update/${appName}/status?deploymentId=${encodeURIComponent(deploymentId)}`,
            ).catch(() => undefined)

            if (!response?.ok) {
                return
            }

            const status = (await response.json()) as { state: string; reason?: string }
            setProgress({ phase: "polling", deploymentId, state: status.state })

            if (status.state === "succeeded" || status.state === "failed") {
                clearInterval(pollTimer.current)
                setProgress({ phase: "done", state: status.state, reason: status.reason })
            }
        }, 1000)
    }

    const busy = progress.phase === "uploading" || progress.phase === "polling"

    return (
        <form
            className={"mx-auto mt-24 flex w-96 flex-col gap-4"}
            encType="multipart/form-data"
            onSubmit={async ev => {
                ev.preventDefault()
                setProgress({ phase: "uploading" })

                const response = await fetch("", {
                    method: "POST",
                    body: new FormData(ev.currentTarget),
                }).catch(() => undefined)

                if (!response || !response.ok) {
                    const body = (await response?.json().catch(() => undefined)) as { error?: string } | undefined
                    setProgress({ phase: "error", message: body?.error ?? "Upload failed." })
                    return
                }

                const { deploymentId } = (await response.json()) as { deploymentId: string }
                setProgress({ phase: "polling", deploymentId, state: "extracting" })
                pollStatus(deploymentId)
            }}
        >
            <h1 className={"text-xl font-semibold"}>Deploy an artifact to '{appName}'</h1>
            <label className={"block"}>
                Artifact (zip)
                <Input name={"artifact"} type={"file"} accept={".zip"} required />
            </label>
            <Button type={"submit"} disabled={busy}>
                {busy ? "Deploying…" : "Deploy"}
            </Button>
            {progress.phase === "polling" ? (
                <div>
                    Deployment <code>{progress.deploymentId}</code>: {progress.state}…
                </div>
            ) : null}
            {progress.phase === "done" ? (
                <div className={progress.state === "succeeded" ? "text-green-600" : "text-red-500"}>
                    Deployment {progress.state}
                    {progress.reason ? `: ${progress.reason}` : "."}
                </div>
            ) : null}
            {progress.phase === "error" ? <div className={"text-red-500"}>{progress.message}</div> : null}
        </form>
    )
}
