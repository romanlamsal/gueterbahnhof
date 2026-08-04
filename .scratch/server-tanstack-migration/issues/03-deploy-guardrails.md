# 03 — Deploy guardrails

**What to build:** The deploy contract's failure modes behave per ADR-0001. Deploying to an unknown app name fails fast with 400 (no auto-create). A second deploy while one is in flight for the same app is rejected with 409 carrying the in-flight deployment's id. A failed extract or failed process start ends the Deployment in `failed` with a reason visible on the status endpoint. Deployment records are in-memory only, capped at the last N per app; after a server restart (or for an app never deployed) the status endpoint returns 404.

**Blocked by:** 02 — Deploy tracer bullet (happy path).

**Status:** resolved

- [x] Unknown app name → 400 on POST; deploy never creates an app config
- [x] Concurrent deploy to the same app → 409 + in-flight deployment id; at most one active Deployment per app (enforced in the domain service, unit-tested)
- [x] Failed start or corrupt/failing extract → status reports `failed` with a reason
- [x] Deployment records capped at last N per app; unknown app or forgotten id → 404 on status
- [x] Controller tests cover 400/409/404 status codes and failed-state response shape
