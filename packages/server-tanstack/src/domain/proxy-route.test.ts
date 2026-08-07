import { describe, expect, it } from "vitest"
import { buildProxyRoutes, findProxyRoute, normalizeHost, proxyTargetOf, requestHost } from "./proxy-route.ts"

const headers = (values: Record<string, string>) => (name: string) => values[name]

describe("normalizeHost", () => {
    it("matches on what a host means, not how it was written", () => {
        expect(normalizeHost("API.Example.COM")).toBe("api.example.com")
        expect(normalizeHost("api.example.com:4457")).toBe("api.example.com")
        expect(normalizeHost("api.example.com.")).toBe("api.example.com")
        expect(normalizeHost("  api.example.com  ")).toBe("api.example.com")
    })

    it("takes the first entry when several proxies have appended themselves", () => {
        expect(normalizeHost("api.example.com, inner.internal")).toBe("api.example.com")
    })

    it("keeps an IPv6 literal intact rather than eating its colons", () => {
        expect(normalizeHost("[::1]")).toBe("[::1]")
    })

    it("is undefined for nothing usable", () => {
        expect(normalizeHost(undefined)).toBeUndefined()
        expect(normalizeHost("")).toBeUndefined()
        expect(normalizeHost("   ")).toBeUndefined()
    })
})

describe("requestHost", () => {
    it("prefers the forwarded header, so an edge proxy can front us during a migration", () => {
        expect(requestHost(headers({ "x-forwarded-host": "api.example.com", host: "127.0.0.1:4457" }))).toBe(
            "api.example.com",
        )
    })

    it("falls back to Host when nothing forwarded us", () => {
        expect(requestHost(headers({ host: "api.example.com" }))).toBe("api.example.com")
    })

    it("falls back to Host when the forwarded header is empty rather than absent", () => {
        expect(requestHost(headers({ "x-forwarded-host": "", host: "api.example.com" }))).toBe("api.example.com")
    })

    it("is undefined when the request names no host at all", () => {
        expect(requestHost(headers({}))).toBeUndefined()
    })
})

describe("buildProxyRoutes", () => {
    const app = { name: "api", proxyHost: "api.example.com", port: 20001 }

    it("routes an App that declares a host and resolves to a port", () => {
        expect(buildProxyRoutes([app]).get("api.example.com")).toEqual({ appName: "api", port: 20001 })
    })

    it("resolves the port from the Env when the App has no field, so existing Apps route too", () => {
        const routes = buildProxyRoutes([{ name: "api", proxyHost: "api.example.com", env: { PORT: "3001" } }])

        expect(routes.get("api.example.com")).toEqual({ appName: "api", port: 3001 })
    })

    it("leaves out an App with no Proxy Host — that is the entire opt-in", () => {
        expect(buildProxyRoutes([{ name: "api", port: 20001 }]).size).toBe(0)
    })

    it("leaves out an App that declares a host but resolves to no port", () => {
        expect(buildProxyRoutes([{ name: "api", proxyHost: "api.example.com" }]).size).toBe(0)
    })

    it("normalizes the declared host, so a stray port or capital matches anyway", () => {
        expect(buildProxyRoutes([{ ...app, proxyHost: "API.Example.com:8080" }]).has("api.example.com")).toBe(true)
    })

    it("resolves a duplicated host the same way on every boot", () => {
        const routes = buildProxyRoutes([app, { name: "impostor", proxyHost: "api.example.com", port: 20002 }])

        expect(routes.get("api.example.com")).toEqual({ appName: "api", port: 20001 })
    })
})

describe("findProxyRoute", () => {
    const routes = buildProxyRoutes([{ name: "api", proxyHost: "api.example.com", port: 20001 }])

    it("finds the App a request names", () => {
        expect(findProxyRoute(headers({ host: "api.example.com:4457" }), routes)?.appName).toBe("api")
    })

    it("finds nothing for a host nobody declared, so the request falls through", () => {
        expect(findProxyRoute(headers({ host: "gbh.example.com" }), routes)).toBeUndefined()
        expect(findProxyRoute(headers({}), routes)).toBeUndefined()
    })
})

describe("proxyTargetOf", () => {
    it("is always absolute and always loopback", () => {
        // A target beginning with '/' would be dispatched internally and
        // re-enter our own app instead of leaving the process.
        expect(proxyTargetOf({ appName: "api", port: 20001 })).toBe("http://127.0.0.1:20001")
    })
})
