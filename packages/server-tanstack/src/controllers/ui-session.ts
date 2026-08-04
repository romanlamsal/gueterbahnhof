import { redirect } from "@tanstack/react-router"
import { getRequest } from "@tanstack/react-start/server"
import { getAuthService } from "@/runtime/services.ts"
import { AUTH_COOKIE, getCookieValue } from "./auth-controller.ts"

// Server-only helpers — import these ONLY inside createServerFn handlers so
// the client compiler can strip them from browser bundles.

export const hasValidSession = () => {
    const request = getRequest()
    const token = getCookieValue(request.headers.get("cookie"), AUTH_COOKIE)
    return getAuthService().verifySession(token)
}

export const assertUiSession = () => {
    if (!hasValidSession()) {
        throw redirect({ to: "/login" })
    }
}
