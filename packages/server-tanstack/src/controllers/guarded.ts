import { getAuthController } from "@/runtime/services.ts"
import type { AuthController } from "./auth-controller.ts"

// Wraps a route handler so the guard cannot be forgotten halfway through
// writing one: `guarded.apiKey(handler)` reads as guarded, and a handler
// without a wrapper reads as open.
//
// The controller is resolved per request rather than at module load, so route
// modules stay importable without the Server Config being set.

// Route params are a plain string map, so a handler can read `params.appName`
// without the wrapper having to be generic over each route's shape.
type HandlerContext = { request: Request; params: Record<string, string> }

type Guard = (request: Request) => Response | undefined

export const createGuards = (resolveController: () => Pick<AuthController, keyof AuthController>) => {
    const withGuard =
        (pickGuard: (controller: Pick<AuthController, keyof AuthController>) => Guard) =>
        (handler: (context: HandlerContext) => Response | Promise<Response>) =>
        (context: HandlerContext): Response | Promise<Response> => {
            const denied = pickGuard(resolveController())(context.request)

            return denied ?? handler(context)
        }

    return {
        /** Management API: the API Key, as a header. */
        apiKey: withGuard(controller => request => controller.requireApiKey(request)),
        /** Deploy surface: the API Key from the CLI, or a UI session. */
        apiKeyOrSession: withGuard(controller => request => controller.requireApiKeyOrSession(request)),
        /** UI surface: a signed session, or a redirect to the login page. */
        uiSession: withGuard(controller => request => controller.requireUiSession(request)),
    }
}

export const guarded = createGuards(getAuthController)
