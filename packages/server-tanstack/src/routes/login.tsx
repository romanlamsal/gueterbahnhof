import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { getAuthController } from "@/runtime/services.ts"

export const Route = createFileRoute("/login")({
    component: LoginPage,
    validateSearch: z.object({
        redirect: z.string().optional(),
    }),
    server: {
        handlers: {
            POST({ request }) {
                return getAuthController().postLogin(request)
            },
        },
    },
})

function LoginPage() {
    const { redirect } = Route.useSearch()
    const [error, setError] = useState<string | undefined>()

    return (
        <form
            className={"mx-auto mt-24 flex w-72 flex-col gap-4"}
            onSubmit={async ev => {
                ev.preventDefault()

                const response = await fetch("/login", {
                    method: "POST",
                    body: new FormData(ev.currentTarget),
                })

                if (!response.ok) {
                    setError("Login failed.")
                    return
                }

                window.location.assign(redirect || "/ui")
            }}
        >
            <label className={"block"}>
                API key
                <Input name={"apikey"} type={"password"} autoFocus />
            </label>
            {error ? <div className={"text-red-500"}>{error}</div> : null}
            <Button type={"submit"}>Login</Button>
        </form>
    )
}
