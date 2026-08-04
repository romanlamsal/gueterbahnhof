import type { AuthService } from "@/app-services/auth-service.ts"

export const AUTH_COOKIE = "gueterbahnhof.session"

export const getCookieValue = (cookieHeader: string | null, name: string) => {
    if (!cookieHeader) {
        return undefined
    }

    for (const part of cookieHeader.split(";")) {
        const [key, ...rest] = part.trim().split("=")
        if (key === name) {
            return decodeURIComponent(rest.join("="))
        }
    }

    return undefined
}

export const createAuthController = ({ authService }: { authService: AuthService }) => ({
    // API surface: authorization header, checked on every request.
    requireApiKey(request: Request): Response | undefined {
        if (authService.verifyApiKey(request.headers.get("authorization") ?? undefined)) {
            return undefined
        }

        return Response.json({ error: "Unauthorized." }, { status: 401 })
    },

    // Deploy surface used by both the CLI (header) and the UI upload form
    // (session cookie): either credential passes.
    requireApiKeyOrSession(request: Request): Response | undefined {
        const headerOk = authService.verifyApiKey(request.headers.get("authorization") ?? undefined)
        const sessionOk = authService.verifySession(getCookieValue(request.headers.get("cookie"), AUTH_COOKIE))

        if (headerOk || sessionOk) {
            return undefined
        }

        return Response.json({ error: "Unauthorized." }, { status: 401 })
    },

    // UI surface: signed session cookie, verified — not presence-checked.
    requireUiSession(request: Request): Response | undefined {
        const token = getCookieValue(request.headers.get("cookie"), AUTH_COOKIE)

        if (authService.verifySession(token)) {
            return undefined
        }

        const url = new URL(request.url)

        return new Response(null, {
            status: 302,
            headers: {
                location: `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`,
            },
        })
    },

    async postLogin(request: Request): Promise<Response> {
        const formData = await request.formData().catch(() => undefined)
        const candidate = formData?.get("apikey")

        const token = authService.login(typeof candidate === "string" ? candidate : undefined)

        if (!token) {
            return Response.json({ ok: false, error: "Login failed." }, { status: 401 })
        }

        return Response.json(
            { ok: true },
            {
                headers: {
                    "set-cookie": `${AUTH_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`,
                },
            },
        )
    },
})

export type AuthController = ReturnType<typeof createAuthController>
