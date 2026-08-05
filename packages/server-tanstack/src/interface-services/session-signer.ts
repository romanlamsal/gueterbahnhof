import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Stateless signed session tokens: `issuedAt.nonce.hmac(issuedAt.nonce)`.
// Deterministic per secret, so sessions survive server restarts.
export const createSessionSigner = (secret: string, { now = Date.now }: { now?: () => number } = {}) => {
    const sign = (payload: string) => createHmac("sha256", secret).update(payload).digest("hex")

    return {
        issueToken() {
            const payload = `${now()}.${randomBytes(16).toString("hex")}`
            return `${payload}.${sign(payload)}`
        },

        verifyToken(token: string) {
            const lastDot = token.lastIndexOf(".")

            if (lastDot === -1) {
                return false
            }

            const payload = token.slice(0, lastDot)
            const signature = token.slice(lastDot + 1)
            const expected = sign(payload)

            const signatureBuffer = Buffer.from(signature)
            const expectedBuffer = Buffer.from(expected)

            if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
                return false
            }

            const issuedAt = Number.parseInt(payload.split(".")[0] ?? "", 10)

            if (!Number.isFinite(issuedAt) || now() - issuedAt > SESSION_TTL_MS) {
                return false
            }

            return true
        },
    }
}

export type SessionSigner = ReturnType<typeof createSessionSigner>
