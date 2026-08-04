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
import type { AppConfig } from "@/interface-services/app-config-repository.ts"
import { loadAppsFunc, updateAppFunc } from "@/routes/ui/-lib/server-funcs.ts"

export const Route = createFileRoute("/ui/$appId")({
    component: RouteComponent,
})

const updateMutationOpts = (appId: string) =>
    ({
        mutationFn: config => updateAppFunc({ data: { appId, config } }),
        onSuccess: (nextConfig, _, __, { client }) => {
            client.setQueryData<{ config: AppConfig }[]>(["apps"], prevState => {
                if (!nextConfig || !prevState) {
                    return prevState
                }

                return [...prevState].map(appData =>
                    appData.config.id !== appId
                        ? appData
                        : { ...appData, config: { ...appData.config, ...nextConfig } },
                )
            })
        },
    }) satisfies UseMutationOptions<AppConfig | undefined, Error, Partial<AppConfig>>

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
                                const [key, value] = line.split("=")
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

    const { mutateAsync: updateAppConfig } = useMutation(updateMutationOpts(appId))

    const [envs, setEnvs] = useState<[string, string][]>(app ? Object.entries(app.config.env) : [])
    useEffect(() => {
        if (app?.config.env) {
            setEnvs(Object.entries(app.config.env))
        }
    }, [app?.config.env])

    const [escaped, setEscaped] = useState(false)

    const navigate = useNavigate()
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
            onSubmit={ev => {
                ev.preventDefault()

                const formData = new FormData(
                    ev.currentTarget,
                    (ev.nativeEvent as unknown as { submitter: HTMLElement }).submitter,
                )

                return updateAppConfig({
                    env: Object.fromEntries(envs),
                    name: formData.get("name") as string,
                    entry: formData.get("entry") as string,
                })
            }}
            className={"space-y-8 p-4"}
            key={appId}
        >
            <Button name={"intent"} value={"delete"}></Button>
            <label className={"block"}>
                Name <Input name={"name"} defaultValue={app.config.name} />
            </label>

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
