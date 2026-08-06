import { type UseMutationOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import type { AppMutationResult } from "@/app-services/app-service.ts"
import { AppConfigForm, type AppConfigPatch, type SaveOutcome } from "@/components/AppConfigForm.tsx"
import type { AppConfig } from "@/interface-services/app-config-repository.ts"
import { deleteAppFunc, loadAppsFunc, updateAppFunc } from "@/routes/ui/-lib/server-funcs.ts"

export const Route = createFileRoute("/ui/$appId")({
    component: RouteComponent,
})

const mutationErrorMessages: Record<string, string> = {
    "name-taken": "Another app already uses this name.",
    "not-found": "This app does not exist anymore.",
    invalid: "The config could not be saved.",
}

const updateMutationOpts = (appId: string) =>
    ({
        mutationFn: config => updateAppFunc({ data: { appId, config } }),
        onSuccess: (result, _, __, { client }) => {
            client.setQueryData<{ config: AppConfig }[]>(["apps"], prevState => {
                if (!result.ok || !prevState) {
                    return prevState
                }

                return [...prevState].map(appData =>
                    appData.config.id !== appId
                        ? appData
                        : { ...appData, config: { ...appData.config, ...result.config } },
                )
            })
        },
    }) satisfies UseMutationOptions<AppMutationResult, Error, Partial<AppConfig>>

function RouteComponent() {
    const { appId } = Route.useParams()

    const { data: app } = useSuspenseQuery({
        queryKey: ["apps"],
        queryFn: () => loadAppsFunc(),
        select: data => data.find(d => d.config.id === appId),
    })

    const { mutateAsync: updateAppConfig } = useMutation(updateMutationOpts(appId))

    const navigate = useNavigate()
    const { mutate: deleteApp } = useMutation({
        mutationFn: () => deleteAppFunc({ data: { appId } }),
        onSuccess: (_, __, ___, { client }) => {
            client.invalidateQueries({ queryKey: ["apps"] })
            navigate({ to: "/ui" })
        },
    })

    useEffect(() => {
        if (!app) {
            navigate({ to: "/ui" })
        }
    }, [app])

    if (!app) {
        return null
    }

    const save = async (patch: AppConfigPatch): Promise<SaveOutcome> => {
        const result = await updateAppConfig(patch)

        return result.ok ? { ok: true } : { ok: false, message: mutationErrorMessages[result.code] ?? "Saving failed." }
    }

    return <AppConfigForm key={appId} config={app.config} onSave={save} onDelete={deleteApp} />
}
