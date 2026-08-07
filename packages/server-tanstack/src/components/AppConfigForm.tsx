import { Check, Copy, X } from "lucide-react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { SaveButton, type SaveStatus } from "@/components/SaveButton.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import { describeAppPort, parsePort } from "@/domain/app-port.ts"
import { formatEnvs, parseEnvs } from "@/domain/env-format.ts"
import type { AppConfig } from "@/interface-services/app-config-repository.ts"

export type AppConfigPatch = Pick<AppConfig, "name" | "entry" | "env" | "port" | "proxyHost">
export type SaveOutcome = { ok: true } | { ok: false; message: string }

// PORT has a field of its own, so it must not also be editable as an Env
// variable — two places to change one value can only disagree. Hiding it here
// means a save submits an Env without it, which promotes an inherited value to
// the field without the App's port ever changing.
const withoutPort = (envs: [string, string][]) => envs.filter(([key]) => key !== "PORT")

export const AppConfigForm = ({
    config,
    onSave,
    onDelete,
    defaultTab = "list",
}: {
    config: AppConfig
    onSave: (patch: AppConfigPatch) => Promise<SaveOutcome>
    onDelete: () => void
    defaultTab?: "list" | "dotenv"
}) => {
    const [envs, setEnvs] = useState<[string, string][]>(withoutPort(Object.entries(config.env)))
    const [escaped, setEscaped] = useState(false)
    const [status, setStatus] = useState<SaveStatus>("idle")
    const [message, setMessage] = useState<string | undefined>()
    const [copied, setCopied] = useState(false)

    const dotenvRef = useRef<HTMLTextAreaElement>(null)

    // Show the port the App actually runs on, even when that is still only an
    // Env value, so the field never disagrees with reality.
    const { port, inherited } = describeAppPort(config)

    useEffect(() => {
        setEnvs(withoutPort(Object.entries(config.env)))
    }, [config.env])

    useEffect(() => {
        if (!copied) {
            return
        }

        const timeoutId = setTimeout(() => setCopied(false), 3000)
        return () => clearTimeout(timeoutId)
    }, [copied])

    // The textarea is the truth while it is on screen and edited: read it
    // rather than waiting for a blur that a click on Save may not deliver.
    const currentEnvs = (): [string, string][] => {
        const text = dotenvRef.current?.value

        if (text === undefined) {
            return envs
        }

        try {
            return withoutPort(parseEnvs(text, escaped))
        } catch {
            return envs
        }
    }

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)
        setStatus("saving")
        setMessage(undefined)

        const outcome = await onSave({
            name: formData.get("name") as string,
            entry: formData.get("entry") as string,
            // An empty Port clears the field; undefined survives the round trip
            // as "no port", which is what makes it assignable later.
            port: parsePort(formData.get("port") as string),
            proxyHost: (formData.get("proxyHost") as string).trim() || undefined,
            env: Object.fromEntries(currentEnvs()),
        })

        setStatus(outcome.ok ? "saved" : "error")
        setMessage(outcome.ok ? undefined : outcome.message)
    }

    return (
        <form onSubmit={submit} className={"space-y-8 p-4"}>
            <Button
                type={"button"}
                variant={"destructive"}
                onClick={() => {
                    if (window.confirm(`Delete app '${config.name}'? This removes its process and files.`)) {
                        onDelete()
                    }
                }}
            >
                Delete
            </Button>

            <label className={"block"}>
                Name <Input name={"name"} defaultValue={config.name} />
            </label>

            <label className={"block"}>
                Entry <Input name={"entry"} defaultValue={config.entry} />
            </label>

            {/* The hints sit outside their labels on purpose: inside, they become part of the field's name. */}
            <div>
                <label className={"block"}>
                    Proxy Host <Input name={"proxyHost"} defaultValue={config.proxyHost ?? ""} />
                </label>
                <span className={"text-muted-foreground text-sm"}>
                    The public hostname this app answers on. Leave empty for no host-based proxying.
                </span>
            </div>

            <div>
                <label className={"block"}>
                    Port <Input name={"port"} defaultValue={port ?? ""} inputMode={"numeric"} />
                </label>
                <span className={"text-muted-foreground text-sm"}>
                    {inherited
                        ? "Inherited from the PORT environment variable — saving makes it explicit."
                        : "Leave empty to have one assigned automatically, if a Proxy Host is set."}
                </span>
            </div>

            <Tabs defaultValue={defaultTab}>
                <TabsList>
                    <TabsTrigger value={"list"}>List</TabsTrigger>
                    <TabsTrigger value={"dotenv"}>dotenv</TabsTrigger>
                </TabsList>

                <TabsContent value={"list"}>
                    <ul>
                        {[...envs, ["", ""]].map(([key, value], i) => (
                            <li key={i} className={"grid grid-cols-[repeat(2,1fr)_auto]"}>
                                <Input
                                    aria-label={`Env name ${i + 1}`}
                                    value={key}
                                    onChange={ev =>
                                        setEnvs(prevState => [
                                            ...prevState.slice(0, i),
                                            [ev.target.value, prevState[i]?.[1] ?? ""],
                                            ...prevState.slice(i + 1),
                                        ])
                                    }
                                />
                                <Input
                                    aria-label={`Env value ${i + 1}`}
                                    value={value}
                                    onChange={ev =>
                                        setEnvs(prevState => [
                                            ...prevState.slice(0, i),
                                            [prevState[i]?.[0] ?? "", ev.target.value],
                                            ...prevState.slice(i + 1),
                                        ])
                                    }
                                />
                                <X
                                    aria-label={`Remove env ${i + 1}`}
                                    className={"cursor-pointer text-red-500"}
                                    onClick={() =>
                                        setEnvs(prevState => [...prevState.slice(0, i), ...prevState.slice(i + 1)])
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                </TabsContent>

                <TabsContent value={"dotenv"} className={"space-y-2"}>
                    <div className={"flex items-center gap-4"}>
                        <label className={"inline-flex items-center gap-2"}>
                            Escaped
                            <Input
                                type={"checkbox"}
                                checked={escaped}
                                onChange={ev => setEscaped(ev.target.checked)}
                                className={"inline size-4"}
                            />
                        </label>

                        <Button
                            type={"button"}
                            variant={"outline"}
                            size={"sm"}
                            onClick={async () => {
                                // Always escaped: that form survives pasting anywhere.
                                await navigator.clipboard?.writeText(formatEnvs(currentEnvs(), true))
                                setCopied(true)
                            }}
                        >
                            <Copy className={"mr-1 inline size-4"} />
                            Copy escaped
                        </Button>

                        {copied ? <Check aria-label={"Copied"} className={"size-5 text-green-500"} /> : null}
                    </div>

                    <Textarea
                        ref={dotenvRef}
                        aria-label={"Env as dotenv"}
                        key={escaped.toString()}
                        defaultValue={formatEnvs(envs, escaped)}
                        onBlur={ev => {
                            try {
                                setEnvs(parseEnvs(ev.currentTarget.value, escaped))
                            } catch {
                                console.log("Could not parse dotenv from string.")
                            }
                        }}
                    />
                </TabsContent>
            </Tabs>

            <SaveButton type={"submit"} size={"lg"} status={status} message={message}>
                Save
            </SaveButton>
        </form>
    )
}
