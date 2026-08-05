import { describe, expect, it } from "vitest"
import { formatEnvs, parseEnvs } from "./dotenv-roundtrip.ts"

const roundTrip = (envs: [string, string][], escaped = false) => parseEnvs(formatEnvs(envs, escaped), escaped)

describe("dotenv round-trip (plain mode)", () => {
    it("keeps simple values", () => {
        const envs: [string, string][] = [
            ["PORT", "3000"],
            ["NODE_ENV", "production"],
        ]

        expect(roundTrip(envs)).toEqual(envs)
    })

    it("keeps values containing '=' (connection strings)", () => {
        const envs: [string, string][] = [["DATABASE_URL", "postgres://h/db?sslmode=require&a=1"]]

        expect(roundTrip(envs)).toEqual(envs)
    })

    it("keeps values dotenv would otherwise treat as comments", () => {
        const envs: [string, string][] = [["SECRET", "abc#not-a-comment"]]

        expect(roundTrip(envs)).toEqual(envs)
    })

    it("keeps leading/trailing whitespace and empty values", () => {
        const envs: [string, string][] = [
            ["PADDED", "  spaced out  "],
            ["EMPTY", ""],
        ]

        expect(roundTrip(envs)).toEqual(envs)
    })

    it("keeps values containing quotes", () => {
        const envs: [string, string][] = [
            ["SINGLE", "it's fine"],
            ["DOUBLE", 'say "hi"'],
        ]

        expect(roundTrip(envs)).toEqual(envs)
    })

    it("keeps multiline values", () => {
        const envs: [string, string][] = [["PEM", "-----BEGIN-----\nabc\ndef\n-----END-----"]]

        expect(roundTrip(envs)).toEqual(envs)
    })

    it("parses a hand-written dotenv paste with dotenv semantics", () => {
        const pasted = [
            "# a comment",
            "PLAIN=value",
            "TRIMMED=  padded  ",
            'QUOTED="kept # hash"',
            "WITH_COMMENT=value # stripped",
        ].join("\n")

        expect(parseEnvs(pasted, false)).toEqual([
            ["PLAIN", "value"],
            ["TRIMMED", "padded"],
            ["QUOTED", "kept # hash"],
            ["WITH_COMMENT", "value"],
        ])
    })
})

describe("dotenv round-trip (escaped mode)", () => {
    it("round-trips anything via URI-safe serialization", () => {
        const envs: [string, string][] = [
            ["GNARLY", `it's "quoted" \`ticked\`\nand multiline # hash`],
            ["EMOJI", "🚂 gueterbahnhof"],
        ]

        expect(roundTrip(envs, true)).toEqual(envs)
    })

    it("serializes as URI-safe text", () => {
        const text = formatEnvs([["MSG", "hello world"]], true)

        expect(text).toBe("MSG=hello%20world")
    })

    it("parses pasted URI-safe vars", () => {
        expect(parseEnvs("MSG=hello%20world%0Aline2", true)).toEqual([["MSG", "hello world\nline2"]])
    })

    it("keeps a value that is not valid URI encoding as-is", () => {
        expect(parseEnvs("BROKEN=100%", true)).toEqual([["BROKEN", "100%"]])
    })
})
