import { describe, expect, it, vi } from "vitest"
import { createGuards } from "./guarded.ts"

const denial = () => new Response("Unauthorized.", { status: 401 })

const guardsWith = (
    overrides: Partial<
        Record<"requireApiKey" | "requireApiKeyOrSession" | "requireUiSession", () => Response | undefined>
    > = {},
) => {
    const controller = {
        requireApiKey: vi.fn(overrides.requireApiKey ?? (() => undefined)),
        requireApiKeyOrSession: vi.fn(overrides.requireApiKeyOrSession ?? (() => undefined)),
        requireUiSession: vi.fn(overrides.requireUiSession ?? (() => undefined)),
        postLogin: vi.fn(),
    }

    return { controller, guards: createGuards(() => controller) }
}

const request = () => new Request("http://localhost/apps")

describe("guarded", () => {
    it("runs the handler when the guard lets the request through", async () => {
        const { guards } = guardsWith()
        const handler = vi.fn(async () => new Response("work", { status: 200 }))

        const response = await guards.apiKey(handler)({ request: request(), params: {} })

        expect(response.status).toBe(200)
        expect(handler).toHaveBeenCalled()
    })

    it("returns the guard's response and never runs the handler when denied", async () => {
        const { guards } = guardsWith({ requireApiKey: denial })
        const handler = vi.fn(async () => new Response("work", { status: 200 }))

        const response = await guards.apiKey(handler)({ request: request(), params: {} })

        expect(response.status).toBe(401)
        expect(handler).not.toHaveBeenCalled()
    })

    it("passes the whole context through to the handler", async () => {
        const { guards } = guardsWith()
        const handler = vi.fn(async () => new Response("ok"))
        const context = { request: request(), params: { appName: "my-app" } }

        await guards.apiKey(handler)(context)

        expect(handler).toHaveBeenCalledWith(context)
    })

    it("uses the guard the caller asked for", async () => {
        const { controller, guards } = guardsWith()
        const handler = async () => new Response("ok")

        await guards.apiKeyOrSession(handler)({ request: request(), params: {} })
        expect(controller.requireApiKeyOrSession).toHaveBeenCalled()
        expect(controller.requireApiKey).not.toHaveBeenCalled()

        await guards.uiSession(handler)({ request: request(), params: {} })
        expect(controller.requireUiSession).toHaveBeenCalled()
    })

    it("resolves the controller per request, not when the route is defined", async () => {
        const controller = {
            requireApiKey: vi.fn(() => undefined),
            requireApiKeyOrSession: vi.fn(() => undefined),
            requireUiSession: vi.fn(() => undefined),
            postLogin: vi.fn(),
        }
        const resolve = vi.fn(() => controller)
        const wrapped = createGuards(resolve).apiKey(async () => new Response("ok"))

        // defining the route must not have touched the Server Config
        expect(resolve).not.toHaveBeenCalled()

        await wrapped({ request: request(), params: {} })
        expect(resolve).toHaveBeenCalledTimes(1)
    })
})
