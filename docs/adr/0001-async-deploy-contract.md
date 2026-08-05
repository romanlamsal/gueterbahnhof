# Asynchronous deploy contract

Artifacts can be very fat, and holding the HTTP connection open through extract + start risks proxy/runner timeouts after the upload finishes. So `POST /update/:appname` responds **202 + `{ deploymentId }`** as soon as the artifact is received; the actual stop-update-start runs as a **Deployment** (`extracting → starting → succeeded | failed`) observable at `GET /update/:appname/status` (which echoes the deployment id for correlation). At most one deployment is in flight per app — a concurrent POST gets a 409. Deployment state is in-memory only (last N per app); a server restart mid-deploy kills the deploy, and polling an unknown id yields 404.

## Consequences

- A 200/202 from deploy does **not** mean the app is running. Callers that need the truth must poll the status endpoint.
- The CLI is fire-and-forget by default and exposes `--wait`; the repo's GitHub Action sets `wait: true` so CI fails on failed deploys.
- Rejected: a single synchronous endpoint (timeout-prone with fat bundles) and status addressed by deployment id (`GET /deployments/:id`) — per-app status was chosen since the 409 rule makes the active deployment per app unambiguous.
