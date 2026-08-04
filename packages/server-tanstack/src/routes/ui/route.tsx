import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { Button } from "@/components/ui/button.tsx"
import { getSessionStatusFunc } from "@/routes/ui/-lib/auth-funcs.ts"
import { createAppFunc, loadAppsFunc } from "@/routes/ui/-lib/server-funcs.ts"

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

    const navigate = useNavigate()
    const { mutate: addAppMutation } = useMutation({
        mutationFn: () => createAppFunc(),
        onSuccess: (data, __, ___, context) => {
            context.client.invalidateQueries({ queryKey: ["apps"] })
            if (data) {
                navigate({ to: "/ui/$appId", params: { appId: data.id } })
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
                    >
                        {app.config.name}
                    </Button>
                ))}
            </aside>
            <Suspense>
                <Outlet />
            </Suspense>
        </section>
    )
}
