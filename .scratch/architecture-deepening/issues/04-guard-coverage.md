# 04 — Make an unguarded route visible

Type: grilling
Status: resolved
Blocked by: none — can start immediately

## Question

The same four-line guard is retyped in `routes/apps.tsx:8-11`, `routes/ui/events.tsx:8-11`, `routes/update/$appName/route.tsx:22-25` and `status.tsx:10-13`, plus `assertUiSession()` four times in `routes/ui/-lib/server-funcs.ts`. The duplication is tolerable. The risk is not: a forgotten guard is a silent open endpoint, `auth-controller.test.ts` tests the controller in isolation, and **no test asserts that any route is guarded** — precisely the failure the pre-1.0 server shipped with.

Decide:

1. Whether a `guarded(handler)` wrapper is worth it, or whether the coverage alone carries the risk. A wrapper makes "unguarded" read as unguarded; it also adds indirection to four small files.
2. How the coverage is asserted, given routes are file-based with no table to enumerate — see the map's fog. Candidates: a convention test that walks the routes directory and requires each management route's handler to reject an anonymous request; explicit per-route assertions; or a shared handler factory that is itself tested once.
3. Whether the UI server functions are covered by the same mechanism or a separate one — they guard via `assertUiSession()` rather than returning a response.

Then land whichever combination survives the discussion.

## Answer

**A `guarded()` wrapper, tested once; applying it stays a review concern.** The directory-walking and explicit-list options were both declined — the wrapper makes intent visible at each route, and on a single-maintainer repo review is the mechanism.

- `controllers/guarded.ts` exposes `guarded.apiKey`, `guarded.apiKeyOrSession` and `guarded.uiSession`. Each wraps a handler, runs the guard, and returns the denial without ever calling the handler.
- The auth controller is resolved **per request**, not when the route object is built, so route modules stay importable without the Server Config being set — a test asserts exactly that.
- All four management routes now read as `GET: guarded.apiKey(handler)` instead of four lines of ceremony. `routes/apps.tsx` went from eleven lines to nine, and the guard is the first thing you see.
- Five tests on the wrapper: pass-through, denial short-circuiting the handler, the whole context reaching the handler, each guard picking the right check, and the lazy controller resolution.

**Not covered, knowingly:** nothing fails if someone writes a handler without a wrapper — that was the trade taken. A spike proved the alternative works (route modules import cleanly, `Route.options.server.handlers` is reachable, and an anonymous `GET /apps` returns a real 401), so if the risk ever bites, per-route assertions are about twenty lines away.

**UI server functions keep `assertUiSession()`.** They throw a redirect rather than returning a Response, so the wrapper's shape does not fit them; unifying would mean changing how server functions signal denial, which is not worth it here.

I verified the four wrapped routes still deny anonymous requests (401, 401, 401, and 302 for the SSE stream) with a throwaway test, then removed it per the decision above. 140 tests, typecheck and biome clean.
