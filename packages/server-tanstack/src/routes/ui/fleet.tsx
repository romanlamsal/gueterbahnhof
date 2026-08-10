import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { type FormEvent, useRef, useState } from "react"
import { SaveButton, type SaveStatus } from "@/components/SaveButton.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import { formatEnvs, parseEnvs } from "@/domain/env-format.ts"
import { describeFleetSaveRefusal } from "@/domain/fleet-env.ts"
import { loadFleetEnvFunc, saveFleetEnvFunc } from "@/routes/ui/-lib/server-funcs.ts"

// Deliberately its own editor rather than the App form's: that component is
// wired to an App and has a history of silently broken handlers. What matters
// — dotenv parsing — is shared through formatEnvs/parseEnvs, so the two cannot
// disagree about semantics, only about affordances.
export const Route = createFileRoute("/ui/fleet")({
    component: FleetEnvPage,
})

function FleetEnvPage() {
    const { data: fleetEnv, refetch } = useSuspenseQuery({
        queryKey: ["fleet-env"],
        queryFn: () => loadFleetEnvFunc(),
    })

    const [status, setStatus] = useState<SaveStatus>("idle")
    const [message, setMessage] = useState<string | undefined>()
    const textRef = useRef<HTMLTextAreaElement>(null)

    const { mutateAsync: saveFleetEnv } = useMutation({
        mutationFn: (values: Record<string, string>) => saveFleetEnvFunc({ data: { values } }),
    })

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setStatus("saving")
        setMessage(undefined)

        let values: Record<string, string>

        try {
            // Read the textarea rather than waiting for a blur a click on Save
            // may never deliver — the same trap the App form fell into.
            values = Object.fromEntries(parseEnvs(textRef.current?.value ?? "", false))
        } catch {
            setStatus("error")
            setMessage("That is not valid dotenv text.")
            return
        }

        const result = await saveFleetEnv(values)

        if (result.ok) {
            setStatus("saved")
            await refetch()
            return
        }

        setStatus("error")
        setMessage(describeFleetSaveRefusal(result))
    }

    return (
        <form onSubmit={submit} className={"space-y-4 p-4"}>
            <div>
                <h2 className={"font-medium text-lg"}>Fleet env</h2>
                <p className={"text-muted-foreground text-sm"}>
                    Values held once for every app. Refer to one from an app's env as <code>$fleet.name</code>, or{" "}
                    <code>{"${fleet.name}"}</code> when a literal follows it. Names may use letters, digits and
                    underscores.
                </p>
            </div>

            <Textarea
                ref={textRef}
                aria-label={"Fleet env as dotenv"}
                rows={12}
                defaultValue={formatEnvs(Object.entries(fleetEnv), false)}
            />

            <SaveButton type={"submit"} size={"lg"} status={status} message={message}>
                Save
            </SaveButton>
        </form>
    )
}
