import { describe, expect, it } from "vitest"
import { createAuthService } from "@/app-services/auth-service.ts"
import { createSessionSigner } from "@/interface-services/session-signer.ts"
import { AUTH_COOKIE, createAuthController, getCookieValue } from "./auth-controller.ts"

const makeController = (apiKey?: string) => {
    const authService = createAuthService({ apiKey, sessionSigner: createSessionSigner(apiKey ?? "unused") })
    return { controller: createAuthController({ authService }), authService }
}

describe("auth controller: API key", () => {
    it("denies requests without the key from the very first request", () => {
        const { controller } = makeController("s3cret")

        const denied = controller.requireApiKey(new Request("http://localhost/update/my-app", { method: "POST" }))

        expect(denied?.status).toBe(401)
    })

    it("denies requests with a wrong key", () => {
        const { controller } = makeController("s3cret")

        const denied = controller.requireApiKey(
            new Request("http://localhost/update/my-app", { headers: { authorization: "wrong" } }),
        )

        expect(denied?.status).toBe(401)
    })

    it("lets a correct key through", () => {
        const { controller } = makeController("s3cret")

        const denied = controller.requireApiKey(
            new Request("http://localhost/update/my-app", { headers: { authorization: "s3cret" } }),
        )

        expect(denied).toBeUndefined()
    })

    it("lets everything through when no key is configured", () => {
        const { controller } = makeController(undefined)

        expect(controller.requireApiKey(new Request("http://localhost/update/my-app"))).toBeUndefined()
    })
})

describe("auth controller: API key or session", () => {
    it("accepts the key header, a valid session cookie, and rejects neither", async () => {
        const { controller, authService } = makeController("s3cret")

        expect(
            controller.requireApiKeyOrSession(
                new Request("http://localhost/update/my-app", { headers: { authorization: "s3cret" } }),
            ),
        ).toBeUndefined()

        const token = authService.login("s3cret") ?? ""
        expect(
            controller.requireApiKeyOrSession(
                new Request("http://localhost/update/my-app", {
                    headers: { cookie: `${AUTH_COOKIE}=${encodeURIComponent(token)}` },
                }),
            ),
        ).toBeUndefined()

        const denied = controller.requireApiKeyOrSession(new Request("http://localhost/update/my-app"))
        expect(denied?.status).toBe(401)
    })
})

describe("auth controller: UI session", () => {
    it("redirects to login (with a redirect target) when there is no session", () => {
        const { controller } = makeController("s3cret")

        const denied = controller.requireUiSession(new Request("http://localhost/ui/app-1?tab=env"))

        expect(denied?.status).toBe(302)
        expect(denied?.headers.get("location")).toBe(`/login?redirect=${encodeURIComponent("/ui/app-1?tab=env")}`)
    })

    it("rejects a fabricated cookie value", () => {
        const { controller } = makeController("s3cret")

        const denied = controller.requireUiSession(
            new Request("http://localhost/ui", { headers: { cookie: `${AUTH_COOKIE}=fabricated` } }),
        )

        expect(denied?.status).toBe(302)
    })

    it("accepts a cookie issued by login", async () => {
        const { controller } = makeController("s3cret")

        const formData = new FormData()
        formData.set("apikey", "s3cret")
        const loginResponse = await controller.postLogin(
            new Request("http://localhost/login", { method: "POST", body: formData }),
        )

        expect(loginResponse.status).toBe(200)
        const setCookie = loginResponse.headers.get("set-cookie") ?? ""
        expect(setCookie).toContain("HttpOnly")

        const cookieValue = setCookie.split(";")[0]
        const denied = controller.requireUiSession(
            new Request("http://localhost/ui", { headers: { cookie: cookieValue ?? "" } }),
        )

        expect(denied).toBeUndefined()
    })

    it("refuses login with a wrong key", async () => {
        const { controller } = makeController("s3cret")

        const formData = new FormData()
        formData.set("apikey", "wrong")
        const loginResponse = await controller.postLogin(
            new Request("http://localhost/login", { method: "POST", body: formData }),
        )

        expect(loginResponse.status).toBe(401)
        expect(loginResponse.headers.get("set-cookie")).toBeNull()
    })

    it("does not redirect when auth is disabled", () => {
        const { controller } = makeController(undefined)

        expect(controller.requireUiSession(new Request("http://localhost/ui"))).toBeUndefined()
    })
})

describe("getCookieValue", () => {
    it("parses a cookie out of a header", () => {
        expect(getCookieValue("a=1; gueterbahnhof.session=tok%3Den; b=2", "gueterbahnhof.session")).toBe("tok=en")
        expect(getCookieValue("a=1", "missing")).toBeUndefined()
        expect(getCookieValue(null, "missing")).toBeUndefined()
    })
})
