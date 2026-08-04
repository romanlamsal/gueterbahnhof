import {
    type Updater,
    type UseMutationOptions,
    useMutation,
    useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { parse } from "dotenv"
import { X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { SaveButton } from "@/components/SaveButton.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import type { AppMutationResult } from "@/app-services/app-service.ts"
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

const DotenvTextarea = ({
    envs,
    onChangeEnvs,
    escaped = false,
}: {
    envs: [string, string][]
    onChangeEnvs?: (updater: Updater<typeof envs, typeof envs>) => void
    escaped?: boolean
}) => {
    const dotenvFormat = useMemo(
        () =>
            envs
                .map(([key, value]) => `${key}=${escaped ? encodeURIComponent(value) : value}`)
                .join("\n"),
        [envs, escaped],
    )

    return (
        <Textarea
            key={escaped.toString()}
            defaultValue={dotenvFormat}
            onChange={ev => {
                try {
                    const parsed = parse(
                        ev.currentTarget.value
                            .split("\n")
                            .map(line => {
                                const eqIndex = line.indexOf("=")
                                if (eqIndex === -1) {
                                    return line
                                }
                                // split at the FIRST '=' only — values like
                                // postgres://h/db?a=1 contain '=' themselves
                                const key = line.slice(0, eqIndex)
                                const value = line.slice(eqIndex + 1)
                                return `${key}=${!escaped ? encodeURIComponent(value) : value}`
                            })
                            .join("\n"),
                    )
                    onChangeEnvs?.(Object.entries(parsed))
                } catch {
                    console.log("Could not parse dotenv from string.")
                }
            }}
        />
    )
}

function RouteComponent() {
    const { appId } = Route.useParams()

    const { data: app } = useSuspenseQuery({
        queryKey: ["apps"],
        queryFn: () => loadAppsFunc(),
        select: data => data.find(d => d.config.id === appId),
    })

    const [saveError, setSaveError] = useState<string | undefined>()
    const { mutateAsync: updateAppConfig } = useMutation(updateMutationOpts(appId))

    const navigate = useNavigate()
    const { mutate: deleteApp } = useMutation({
        mutationFn: () => deleteAppFunc({ data: { appId } }),
        onSuccess: (_, __, ___, { client }) => {
            client.invalidateQueries({ queryKey: ["apps"] })
            navigate({ to: "/ui" })
        },
    })

    const [envs, setEnvs] = useState<[string, string][]>(app ? Object.entries(app.config.env) : [])
    useEffect(() => {
        if (app?.config.env) {
            setEnvs(Object.entries(app.config.env))
        }
    }, [app?.config.env])

    const [escaped, setEscaped] = useState(false)

    useEffect(() => {
        if (!app) {
            navigate({ to: "/ui" })
        }
    }, [app])

    if (!app) {
        return null
    }

    return (
        <form
            onSubmit={async ev => {
                ev.preventDefault()

                const formData = new FormData(
                    ev.currentTarget,
                    (ev.nativeEvent as unknown as { submitter: HTMLElement }).submitter,
                )

                const result = await updateAppConfig({
                    env: Object.fromEntries(envs),
                    name: formData.get("name") as string,
                    entry: formData.get("entry") as string,
                })

                setSaveError(result.ok ? undefined : (mutationErrorMessages[result.code] ?? "Saving failed."))
            }}
            className={"space-y-8 p-4"}
            key={appId}
        >
            <Button
                type={"button"}
                variant={"destructive"}
                onClick={() => {
                    if (window.confirm(`Delete app '${app.config.name}'? This removes its process and files.`)) {
                        deleteApp()
                    }
                }}
            >
                Delete
            </Button>
            <label className={"block"}>
                Name <Input name={"name"} defaultValue={app.config.name} />
            </label>
            {saveError ? <div className={"text-red-500"}>{saveError}</div> : null}

            <label className={"block"}>
                Entry <Input name={"entry"} defaultValue={app.config.entry} />
            </label>

            <Tabs defaultValue={"list"}>
                <TabsList>
                    <TabsTrigger value={"list"}>List</TabsTrigger>
                    <TabsTrigger value={"dotenv"}>dotenv</TabsTrigger>
                </TabsList>

                <TabsContent value={"list"}>
                    <ul>
                        {[...envs, ["", ""]].map(([key, value], i) => (
                            <li key={i} className={"grid grid-cols-[repeat(2,1fr)_auto]"}>
                                <Input
                                    value={key}
                                    onChange={ev => {
                                        setEnvs(prevState => [
                                            ...prevState.slice(0, i),
                                            [
                                                ev.target.value as string,
                                                prevState[i]?.[1] ?? "",
                                            ] as const,
                                            ...prevState.slice(i + 1),
                                        ])
                                    }}
                                />
                                <Input
                                    value={value}
                                    onChange={ev => {
                                        setEnvs(prevState => [
                                            ...prevState.slice(0, i),
                                            [
                                                prevState[i]?.[0] ?? "",
                                                ev.target.value as string,
                                            ] as const,
                                            ...prevState.slice(i + 1),
                                        ])
                                    }}
                                />
                                <X
                                    className={"cursor-pointer text-red-500"}
                                    onClick={() =>
                                        setEnvs(prevState => [
                                            ...prevState.slice(0, i),
                                            ...prevState.slice(i + 1),
                                        ])
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                </TabsContent>
                <TabsContent value={"dotenv"}>
                    <label className={"inline-flex items-center gap-2"}>
                        Escaped
                        <Input
                            type={"checkbox"}
                            checked={escaped}
                            onChange={ev => setEscaped(ev.target.checked)}
                            className={"inline size-4"}
                        />
                    </label>
                    <DotenvTextarea envs={envs} escaped={escaped} />
                </TabsContent>
            </Tabs>
            <SaveButton size={"lg"} iconPosition={"left"}>
                Save
            </SaveButton>
        </form>
    )
}
