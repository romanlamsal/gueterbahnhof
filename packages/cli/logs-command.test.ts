import { describe, expect, it } from "vitest"
import { resolveLogsInvocation } from "./logs-command.js"

const invocation = (overrides: Partial<Parameters<typeof resolveLogsInvocation>[0]> = {}) =>
    resolveLogsInvocation({ unit: "gueterbahnhof", lines: 100, follow: false, errors: false, ...overrides })

describe("resolveLogsInvocation — the server's journal", () => {
    it("tails the unit with the requested line count", () => {
        expect(invocation()).toEqual({
            kind: "server",
            command: "journalctl",
            args: ["--user", "-u", "gueterbahnhof", "-n", "100"],
        })
    })

    it("honours --unit", () => {
        expect(invocation({ unit: "gbhf-staging" }).args).toContain("gbhf-staging")
    })

    it("follows with -f", () => {
        expect(invocation({ follow: true }).args).toContain("-f")
    })

    it("filters to real errors with --errors", () => {
        expect(invocation({ errors: true }).args).toEqual(expect.arrayContaining(["-p", "err"]))
    })

    it("appends passthrough arguments last, so they can override", () => {
        const { args } = invocation({ passthrough: ["--since", "yesterday"] })

        expect(args.slice(-2)).toEqual(["--since", "yesterday"])
    })
})

describe("resolveLogsInvocation — an app's pm2 logs", () => {
    it("targets the named app", () => {
        const result = invocation({ app: "scrumpoker" })

        expect(result.kind).toBe("app")
        expect(result.args).toEqual(expect.arrayContaining(["logs", "scrumpoker", "--lines", "100"]))
    })

    it("passes --nostream when not following, since pm2 streams by default", () => {
        expect(invocation({ app: "scrumpoker" }).args).toContain("--nostream")
        expect(invocation({ app: "scrumpoker", follow: true }).args).not.toContain("--nostream")
    })

    it("shows only error output with --errors", () => {
        expect(invocation({ app: "scrumpoker", errors: true }).args).toContain("--err")
    })

    it("appends passthrough arguments last", () => {
        const { args } = invocation({ app: "scrumpoker", passthrough: ["--raw"] })

        expect(args.at(-1)).toBe("--raw")
    })

    it("never mentions the unit — that is the server's concern", () => {
        expect(invocation({ app: "scrumpoker" }).args).not.toContain("gueterbahnhof")
    })
})
