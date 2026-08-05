import { createHash, timingSafeEqual } from "node:crypto"
import type { SessionSigner } from "@/interface-services/session-signer.ts"

const safeEqual = (a: string, b: string) =>
    timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest())

// One optional API key protects everything; without one, the server runs
// open (trusted-network mode). Decided in the migration grilling session.
export const createAuthService = ({
    apiKey,
    sessionSigner,
}: {
    apiKey: string | undefined
    sessionSigner: SessionSigner
}) => ({
    isEnabled() {
        return !!apiKey
    },

    verifyApiKey(candidate: string | undefined) {
        if (!apiKey) {
            return true
        }

        return !!candidate && safeEqual(candidate, apiKey)
    },

    login(candidate: string | undefined): string | undefined {
        if (!apiKey || !candidate || !safeEqual(candidate, apiKey)) {
            return undefined
        }

        return sessionSigner.issueToken()
    },

    verifySession(token: string | undefined) {
        if (!apiKey) {
            return true
        }

        return !!token && sessionSigner.verifyToken(token)
    },
})

export type AuthService = ReturnType<typeof createAuthService>
