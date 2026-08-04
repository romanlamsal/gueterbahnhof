import { describe, expect, it } from "vitest"
import { createSessionSigner } from "@/interface-services/session-signer.ts"
import { createAuthService } from "./auth-service.ts"

const withKey = (apiKey?: string) =>
    createAuthService({ apiKey, sessionSigner: createSessionSigner(apiKey ?? "unused") })

describe("authService with an API key configured", () => {
    it("accepts only the exact API key", () => {
        const auth = withKey("s3cret")

        expect(auth.verifyApiKey("s3cret")).toBe(true)
        expect(auth.verifyApiKey("wrong")).toBe(false)
        expect(auth.verifyApiKey(undefined)).toBe(false)
        expect(auth.verifyApiKey("")).toBe(false)
    })

    it("logs in with the correct key and issues a verifiable session", () => {
        const auth = withKey("s3cret")

        const token = auth.login("s3cret")

        expect(token).toBeDefined()
        expect(auth.verifySession(token)).toBe(true)
    })

    it("refuses login with a wrong key", () => {
        const auth = withKey("s3cret")

        expect(auth.login("nope")).toBeUndefined()
    })

    it("rejects fabricated or missing session cookies", () => {
        const auth = withKey("s3cret")

        expect(auth.verifySession(undefined)).toBe(false)
        expect(auth.verifySession("")).toBe(false)
        expect(auth.verifySession("fabricated-value")).toBe(false)
        expect(auth.verifySession("s3cret")).toBe(false)
    })

    it("is enabled", () => {
        expect(withKey("s3cret").isEnabled()).toBe(true)
    })
})

describe("authService without an API key", () => {
    it("lets everything through", () => {
        const auth = withKey(undefined)

        expect(auth.isEnabled()).toBe(false)
        expect(auth.verifyApiKey(undefined)).toBe(true)
        expect(auth.verifyApiKey("anything")).toBe(true)
        expect(auth.verifySession(undefined)).toBe(true)
    })
})
