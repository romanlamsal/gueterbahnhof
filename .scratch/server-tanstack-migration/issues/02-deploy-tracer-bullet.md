# 02 — Deploy tracer bullet (happy path)

**What to build:** A deployer can POST a zipped artifact to `/update/:appname` (by app name, matching the published client) and immediately receive `202 { deploymentId }`. In the background the Deployment runs `extracting → starting`: the artifact store replaces the app's directory with the extracted zip, the process manager starts the app with its configured entry and env, and `GET /update/:appname/status` reports `{ deploymentId, state: "succeeded" }`. Demoable end-to-end with curl against a dev server. (Per ADR-0001; edge cases like 409/400/failure reporting are ticket 03.)

**Blocked by:** 01 — Prefactor: layer the codebase.

**Status:** resolved

- [x] `POST /update/:appname` with multipart field `artifact` returns 202 with a deployment id for a configured app
- [x] The app directory is wiped and replaced by the extracted artifact; the app is stopped (if running) and started via the process manager
- [x] `GET /update/:appname/status` echoes the deployment id and reaches `succeeded`
- [x] Deployment lifecycle rules live in a domain service (pure unit tests); orchestration in an app service (tested with fake process manager and stores); upload/extract in the artifact store interface service (tested against real fs and real zips)
- [x] Controller tests cover the 202 shape and status route through the HTTP handler with app services mocked
- [x] Real pm2 is never started by any test
