import { describe, expect, it } from "vitest"
import { createSessionSigner } from "./session-signer.ts"

describe("sessionSigner", () => {
    it("verifies a token it issued", () => {
        const signer = createSessionSigner("secret")

        const token = signer.issueToken()

        expect(signer.verifyToken(token)).toBe(true)
    })

    it("rejects a tampered token", () => {
        const signer = createSessionSigner("secret")

        const token = signer.issueToken()
        const [issuedAt, nonce, signature] = token.split(".")

        expect(signer.verifyToken(`${issuedAt}.${nonce}x.${signature}`)).toBe(false)
        expect(signer.verifyToken(`${issuedAt}.${nonce}.${signature?.slice(0, -2)}ff`)).toBe(false)
    })

    it("rejects a token signed with a different secret", () => {
        const signer = createSessionSigner("secret")
        const otherSigner = createSessionSigner("other-secret")

        expect(signer.verifyToken(otherSigner.issueToken())).toBe(false)
    })

    it("rejects garbage", () => {
        const signer = createSessionSigner("secret")

        expect(signer.verifyToken("")).toBe(false)
        expect(signer.verifyToken("not-a-token")).toBe(false)
        expect(signer.verifyToken("a.b.c")).toBe(false)
    })

    it("rejects an expired token", () => {
        let currentTime = 1_000_000
        const signer = createSessionSigner("secret", { now: () => currentTime })

        const token = signer.issueToken()
        expect(signer.verifyToken(token)).toBe(true)

        currentTime += 8 * 24 * 60 * 60 * 1000

        expect(signer.verifyToken(token)).toBe(false)
    })
})
