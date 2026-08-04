# Spec: server-tanstack migration

Status: ready-for-agent

Sources: `current-state.md` (survey + decisions), ADR-0001 (async deploy contract), ADR-0002 (no-daemon pm2 lifecycle), `CONTEXT.md` (vocabulary).

## Problem Statement

Gueterbahnhof's server works but its UI is raw server-rendered htmx that the operator hates using, its API-key enforcement is broken (the first deploy is effectively unauthenticated and UI login only checks cookie presence), and a deploy reports success before anything happened — CI stays green when a deploy fails. A TanStack Start rewrite was started in `server-tanstack` with a modern UI, but its deploy endpoint is a stub, it has no auth, no delete flow, no public status API, and it isn't wired into the published CLI. The operator is stuck between a complete-but-crummy server and a pleasant-but-incomplete one.

## Solution

Finish the TanStack Start server to full parity-plus and make it the one server that ships in the published `@lamsal-de/gueterbahnhof` CLI. Deploys keep the existing by-name contract but become properly asynchronous Deployments (202 + status endpoint) so fat artifacts don't time out and waiting callers learn the truth. Auth becomes a single API key enforced on every route with a verified session cookie for the UI. The UI gains live app state over SSE, a real delete flow, and a "no artifact" signal. Legacy installs migrate automatically on first boot. The express server, the dead reverse-proxy types, and the template leftovers are removed.

## User Stories

### Deploying
1. As a CI pipeline, I want to POST an artifact to `/update/:appname` exactly as today, so that upgrading the server does not require touching my pipelines.
2. As a CI pipeline, I want an immediate 202 with a deployment id once the artifact is received, so that fat uploads don't hold connections through extract and start.
3. As a deployer, I want `GET /update/:appname/status` to report the current deployment's id and state (extracting, starting, succeeded, failed), so that I can find out whether my deploy actually worked.
4. As a deployer, I want a deploy to an unknown app name to fail with 400, so that a typo'd name fails loudly instead of minting a ghost app.
5. As a deployer, I want a concurrent deploy to the same app to be rejected with 409 and the in-flight deployment's id, so that racing uploads can't corrupt an app directory.
6. As a deployer, I want the winning deploy to stop the app, replace its directory with the extracted artifact, and start it again, so that the latest artifact is always what runs.
7. As a deployer, I want deploy and status requests to require the API key when one is configured, so that only authorized parties can push code to my server.
8. As a CLI user, I want `gueterbahnhof deploy <dir>` to zip and upload and exit right after the 202 by default, so that my local deploys stay fast.
9. As a CLI user, I want a `--wait` flag that polls the status endpoint until the deployment succeeds or fails and exits non-zero on failure or timeout, so that scripts can depend on the outcome.
10. As a GitHub Actions user, I want the bundled action to pass `wait: true`, so that my workflow turns red when a deploy fails.
11. As a deployer polling status, I want the response to echo the deployment id from my 202, so that I can tell my deployment's outcome apart from a later one.

### Operating apps in the UI
12. As an operator, I want to create a new app from the UI and get taken straight to its config form, so that setting up an app is one click.
13. As an operator, I want app names to be unique and enforced on save, so that by-name deploys are never ambiguous.
14. As an operator, I want to edit an app's name, entry, and env vars in a pleasant form, so that reconfiguring doesn't feel like filling in a punch card.
15. As an operator, I want to edit env vars both as key/value rows and as a raw dotenv textarea, so that I can paste an existing .env file wholesale.
16. As an operator, I want a saved config change to restart the app only when something process-relevant changed (name, entry, env), so that saves are safe to spam.
17. As an operator, I want to see each app's live state (online, stopped, pending) update in the UI without refreshing, so that I can watch a deploy or crash as it happens.
18. As an operator, I want apps whose config exists but whose artifact was never deployed to show a distinct "no artifact" state, so that I don't mistake a never-deployed app for a crashed one.
19. As an operator, I want to delete an app behind a confirm dialog and have its process, config, env sidecar, and extracted directory all removed, so that nothing orphaned lingers.
20. As an operator, I want to log into the UI with the API key and receive a verified session, so that a stolen or fabricated cookie does not grant access.
21. As an operator without an API key configured, I want the UI and API to work unauthenticated, so that a firewalled home-lab setup stays zero-config.

### Observing programmatically
22. As a monitoring script, I want `GET /apps` to return every app's id, name, and state as JSON, so that I can build health checks without scraping the UI.
23. As a monitoring script, I want `GET /apps` protected by the same API key, so that app inventory doesn't leak.

### Running the server
24. As an administrator, I want `gueterbahnhof server` from the published CLI to start the new server with `--app-dir`, `--port` (default 4444), and `--api-key` flags plus env fallbacks, so that upgrading is a drop-in.
25. As an administrator, I want a missing app directory to be created or to fail fast with a clear error, so that the server never hangs on an interactive prompt under systemd.
26. As an administrator, I want boot to start every configured app and log how many came up, so that a reboot restores the fleet.
27. As an administrator with a legacy `apps.json`, I want first boot to migrate it automatically into per-app config files (minting ids, renaming the old file), so that existing installs upgrade with zero manual steps and keep running.
28. As an administrator, I want SIGTERM/SIGINT to wipe the managed pm2 processes before exiting, so that no stale process state survives (per ADR-0002).
29. As an administrator, I want the server to keep managing everything in-process (no pm2 daemon), so that killing gueterbahnhof reliably kills everything it started.

### Codebase health
30. As a maintainer, I want the server code split into controller, app service, domain service, and interface service layers, so that each layer can be tested against a mock of the one below it.
31. As a maintainer, I want the config schema and UI to say `entry` (pm2's `script` only inside the process-manager adapter), so that the code speaks the glossary's language.
32. As a maintainer, I want the express server package, the dead `Service`/`App` reverse-proxy types, and the TanStack template leftovers removed, so that the repo contains exactly one server and no fossils.

## Implementation Decisions

### Architecture: four layers
- **Controllers**: HTTP routes and server functions. Parse/validate input, enforce auth, delegate to app services, shape responses (202/400/409, SSE stream). No business rules.
- **App services**: use-case orchestration — deploy lifecycle, app CRUD with restart-on-relevant-change, boot/shutdown sequences, legacy config migration.
- **Domain services**: pure rules — the deployment state machine (`extracting → starting → succeeded | failed`, one in flight per app), config validation and name uniqueness, env/config diffing, app-state derivation including "no artifact".
- **Interface services**: adapters to the world — process manager (pm2), config repository (fs), artifact store (receive upload, unzip, swap app directory), session signing. The pm2 adapter stays logic-free.

### Deploy contract (ADR-0001)
- `POST /update/:appname` (multipart field `artifact`, a zip): 202 + `{ deploymentId }` on acceptance; 400 unknown name; 409 + in-flight id while a deployment is active; auth required when a key is set.
- `GET /update/:appname/status`: current/latest deployment as `{ deploymentId, state }` (+ failure reason); 404 when unknown.
- Deployment records are in-memory only, last N per app; a restart forgets them.
- Deploy never creates apps.

### Auth
- One optional API key. Every API route checks the `authorization` header. UI login exchanges the key for a signed httpOnly session cookie whose value is cryptographically verified on each request (not the key itself, not presence-checked). No key configured → everything open.

### Config & migration
- Per-app config file named by a stable random id, plus optional dotenv sidecar merged at read time. Fields: `id`, `name` (unique), `entry` (optional; app can't start without it), `env`.
- First boot with a legacy `apps.json` present: mint ids, write per-app files (`entry` copies over verbatim), rename the legacy file to `apps.json.migrated`, log the outcome.

### Process lifecycle (ADR-0002)
- No-daemon pm2, connect at boot, start all configured apps; SIGTERM/SIGINT wipes (deletes) processes, once, then exits.
- Config-save restart rules: name or entry change → stop old, start new; env change → stop **and delete** the process before starting (pm2 caches env); nothing relevant changed → no restart.

### UI
- Live state via an SSE endpoint fed by the pm2 event bus service (which already exists but has no consumer); client subscribes and patches the react-query cache.
- App state vocabulary shown to the operator: `online`, `stopped`, `pending`, `no artifact` (derived: config exists, app directory missing).
- Delete: confirm dialog → stop+delete process, delete config file, env sidecar, and app directory.
- The TanStack template landing page is replaced by a redirect to the app list (or the list itself at `/`).

### Packaging
- The published CLI's `server` subcommand hosts the built TanStack Start output (the express wrapper pattern from the dev server, minus vite). Flags `--app-dir`/`--port`/`--api-key`, env fallbacks (`GUETERBAHNHOF_APP_DIR`, `GUETERBAHNHOF_PORT`, `GUETERBAHNHOF_API_KEY`), port default 4444. Missing app dir: create it; on failure exit non-zero with a clear message. No interactive prompts.
- `deploy` subcommand gains `--wait` (poll until terminal state, exit non-zero on failure/timeout); default remains fire-and-forget. The GitHub Action adds a `wait` input defaulting to true.
- The legacy express server package and the shared `App`/`Service` types are deleted once the CLI switches over; the common package keeps only what's still consumed.

## Testing Decisions

- First tests in the repo — no prior art. Vitest (already configured in the tanstack package). Tests assert external behavior of the layer under test, never internals of layers below.
- **Mocking matrix** (each layer mocks exactly the layer below):
  - *Interface services*: fs-backed ones (config repository, artifact store) run against the real filesystem in a per-test tmpdir with real zips. The pm2 adapter is not tested (thin, logic-free) and **real pm2 is never started in any test** — daemon state and child processes make it inherently flaky.
  - *Domain services*: pure unit tests, no mocks at all.
  - *App services*: tested against in-memory fakes of the interface services (fake process manager with controllable status transitions, fake stores).
  - *Controllers*: HTTP-level tests through the fetch handler with app services mocked — covering status codes (202/400/401/409), auth on every route, response shapes, and the SSE stream framing.
- The CLI's `--wait` behavior is tested over real HTTP against a controller backed by mocks — no new seam.
- Key scenarios that must be covered: full deploy happy path, deploy to unknown name, concurrent deploy 409, failed start reported as failed deployment, status 404 after restart (fresh in-memory state), legacy `apps.json` auto-migration, env-change causing delete+start, delete-app full cleanup, "no artifact" derivation, unauthenticated request rejection when a key is set, everything-open when no key is set.

## Out of Scope

- Reverse proxying, hostnames, TLS termination (the dead `Service` idea stays dead).
- pm2 daemon mode or apps surviving a server restart (rejected in ADR-0002).
- Persistent deployment history/audit log (in-memory last-N only).
- Multi-user auth, accounts, roles.
- Auto-creating apps on first deploy.
- App log viewing/streaming in the UI, metrics, resource graphs.
- Rollback to a previous artifact.
- UI component/browser tests.

## Further Notes

- Glossary terms (`CONTEXT.md`) are binding: App, Artifact, Deploy, Deployment, App Config, Entry, Env, App Directory, App State, Management API, API Key, Process Manager, Client, CLI. "Service" is an avoided term — `createService` in the current tanstack code should become `createApp` when touched.
- Backward compatibility is a hard constraint on the wire: published CLI 0.2.2 and the GitHub Action must keep working against the new server unmodified (they ignore the 202 body today).
- The old deploy semantics responded 200 before doing anything; the new 202 is honest about the same timing, so old clients observe no behavioral difference.
