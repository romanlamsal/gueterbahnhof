import { createServerFn } from "@tanstack/react-start"
import { hasValidSession } from "@/controllers/ui-session.ts"

export const getSessionStatusFunc = createServerFn({ method: "GET" }).handler(() => ({
    authed: hasValidSession(),
}))
