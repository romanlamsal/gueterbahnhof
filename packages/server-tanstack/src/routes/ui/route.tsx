import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router"
import { Suspense, useEffect } from "react"
import { Button } from "@/components/ui/button.tsx"
import type { AppState } from "@/domain/app-state.ts"
import { getSessionStatusFunc } from "@/routes/ui/-lib/auth-funcs.ts"
import { createAppFunc, loadAppsFunc } from "@/routes/ui/-lib/server-funcs.ts"

const stateBadgeClasses: Record<AppState, string> = {
    online: "bg-green-500",
    stopped: "bg-red-500",
    pending: "bg-yellow-500",
    "no-artifact": "bg-gray-400",
}

const stateLabels: Record<AppState, string> = {
    online: "online",
    stopped: "stopped",
    pending: "pending",
    "no-artifact": "no artifact",
}

export const Route = createFileRoute("/ui")({
    component: RouteComponent,
    beforeLoad: async ({ location }) => {
        const { authed } = await getSessionStatusFunc()

        if (!authed) {
            throw redirect({ to: "/login", search: { redirect: location.href } })
        }
    },
})

function RouteComponent() {
    const { data: apps } = useSuspenseQuery({
        queryKey: ["apps"],
        queryFn: () => loadAppsFunc(),
    })

    const queryClient = useQueryClient()
    useEffect(() => {
        const events = new EventSource("/ui/events")

        events.onmessage = () => {
            queryClient.invalidateQueries({ queryKey: ["apps"] })
        }

        return () => events.close()
    }, [queryClient])

    const navigate = useNavigate()
    const { mutate: addAppMutation } = useMutation({
        mutationFn: () => createAppFunc(),
        onSuccess: (data, __, ___, context) => {
            context.client.invalidateQueries({ queryKey: ["apps"] })
            if (data.ok) {
                navigate({ to: "/ui/$appId", params: { appId: data.config.id } })
            }
        },
    })

    return (
        <section className={"grid grid-cols-[auto_1fr]"}>
            <aside className={"flex flex-col"}>
                <Button onClick={() => addAppMutation()}>Add App</Button>
                {apps.map(app => (
                    <Button
                        variant={"outline"}
                        key={app.config.id}
                        onClick={() =>
                            navigate({ to: "/ui/$appId", params: { appId: app.config.id } })
                        }
                        className={"justify-start gap-2"}
                        title={stateLabels[app.state]}
                    >
                        <span
                            className={`inline-block size-2 shrink-0 rounded-full ${stateBadgeClasses[app.state]}`}
                        />
                        {app.config.name}
                        {app.state === "no-artifact" ? (
                            <span className={"text-xs text-gray-400"}>(no artifact)</span>
                        ) : null}
                    </Button>
                ))}
            </aside>
            <Suspense>
                <Outlet />
            </Suspense>
        </section>
    )
}
