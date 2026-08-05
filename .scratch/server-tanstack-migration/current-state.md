# Current state: express server vs. tanstack-start server

Status: resolved
Type: research

Survey of what exists today, written to support the future migration of
`packages/server` (express + htmx-ish SSR UI) to `packages/server-tanstack`
(TanStack Start + shadcn UI). See `CONTEXT.md` for the domain vocabulary.

## Package map

| Package | npm name | Role |
| --- | --- | --- |
| `packages/server` | `@gueterbahnhof/server` | The deployment server: management API + SSR UI, drives pm2 |
| `packages/client` | `@gueterbahnhof/client` | Client: zips a directory, POSTs it to `/update/:appname` |
| `packages/common` | `@gueterbahnhof/common` | Shared types (`ServerConfig`; `App.ts` is dead code, see below) |
| `packages/cli` | `@lamsal-de/gueterbahnhof` | Published bin bundling server + client commands (esbuild via `bundle.js`) |
| `packages/server-tanstack` | `server-tanstack` (private, unwired) | The migration target, started from a TanStack Start template |
| `action/` | — | Composite GitHub Action wrapping `pnpx @lamsal-de/gueterbahnhof deploy` |

## Legacy server (`packages/server`) — behavior inventory

Everything below is behavior the migration must either reproduce or consciously drop.

### Boot & config
- `cli.ts` (commander): `--app-dir` (required, `GUETERBAHNHOF_APP_DIR`), `--port` (`GUETERBAHNHOF_PORT`, default 4444), `--api-key` (`GUETERBAHNHOF_API_KEY`).
- `createMainServer.ts`: connects to pm2, loads app configs from `<appDir>/apps.json` (lowdb, single file keyed by app name), then boots every configured app.
- Graceful shutdown on SIGTERM/SIGINT: **stops** started apps (does not delete them from pm2).

### App lifecycle
- `pm.ts#startOrReload`: if pm2 reports the process online → stop, then start fresh with `{ name, script: entry, cwd: <appDir>/<name>, env }`. (An actual pm2 `reload` is commented out.)
- `app/appState.ts`: in-memory `{ [name]: state }` with states `pending | started | errored-start | no-entry`. `no-entry` = config exists but no artifact directory yet. State is only updated when the server itself acts — there is no pm2 event subscription.

### Management API (`managementApi.ts`)
- `POST /update/:appname` (multer, in-memory buffer): 400 if no config exists (deploy does NOT create apps); responds 200 **before** doing the work; `rm -rf <appDir>/<name>`, unzip artifact there, start-or-reload.
- API-key check is broken as written: the check is registered *inside* the update handler (`router.use` on first request) instead of as up-front middleware — effectively the first update is always unauthenticated.
- `GET /status/:name` — raw pm2 describe JSON.
- `GET /apps` — the in-memory app-state map.

### UI (`src/ui`, express + renderToString + htmx)
- `GET /ui` list, `GET /ui/app/:appname?` form, `POST /ui/app` save/delete (intent field), `POST /ui/add-env` htmx row.
- Save flow (`updateAppConfig.ts`): persist config; if renamed, stop the old process name; then start-or-reload. Env vars edited as name/value pair rows.
- Login (`components/Login.tsx`): if apiKey set, `/ui/*` requires cookie `gueterbahnhof.auth-token`; login form just compares the posted value to apiKey and stores **the apiKey itself** in the cookie (httpOnly, lax). Note: the guard only checks cookie *presence*, not its value.

### Client & CLI
- `client/src/postArtifact.ts`: `AdmZip` a directory → multipart field `artifact` → `POST <host>/update/<appName>` with `authorization: <apiKey>` header. Env-configurable (`GUETERBAHNHOF_HOST`, `GUETERBAHNHOF_APP_NAME`).
- `cli/cli.ts`: commander program `server` + `deploy`, version from package.json.
- `action/action.yaml`: thin wrapper over the deploy command.

## Tanstack server (`packages/server-tanstack`) — what exists

Rewrite, not a port: it reimplements the domain libs from scratch and shares nothing with `@gueterbahnhof/common` yet.

### Working
- `custom-server.js`: express wrapper hosting the Start app (vite middleware in dev, `.output` in prod, PORT env default 3000). Requires `GUETERBAHNHOF_DIR` env (zod-validated in `lib/$env.ts`); interactive confirm to create it. Connects pm2, boots all apps, SIGTERM/SIGINT **deletes** all pm2 processes (`wipeAllApps`) — different from legacy, which only stops them.
- `lib/app-config-repository.ts`: one JSON file per app at `<GUETERBAHNHOF_DIR>/apps/<appId>.json`, zod `AppConfigSchema { id, name, script?, env }`; an optional sibling `<appId>.env` dotenv file is merged into env at read time. **New concepts vs legacy: apps have a stable random `id` separate from the display `name`; per-app config files instead of one apps.json; `script` instead of `entry`.**
- `lib/pm-service.ts`: promisified pm2 (describe/start/stop/delete, start-or-restart). Skips start when no `script` set.
- `lib/app-service.ts`: orchestration. `updateAppConfig` diffing: name/script change → stop+start; env change → stop+**delete**+start (pm2 caches env on the process).
- `lib/app-state-service.ts`: subscribes to the pm2 event bus (`launchBus`), dedupes into `online | stopped | pending`, exposes a typed event emitter. Initialized in `server.ts`, **but nothing consumes the events yet** (no SSE/stream to the UI).
- UI `/ui` (routes/ui): app list sidebar + "Add App" (creates an empty config with `id = randomUUID()`, navigates to it); `/ui/$appId` edit form — name, script, env as pair-list **and** raw dotenv textarea (with URI-escape toggle), saved via `updateAppFunc` server function with react-query cache patching.

### Half-built / missing (the migration gap)
1. **Deploy endpoint is a stub.** `routes/update/$appId/route.tsx` parses the multipart upload (busboy → tmp file → unzip to tmpdir) and then just returns the parsed data as JSON. It never moves the artifact into the app's directory, never touches the app config, never restarts the app. The legacy stop-update-start contract is not yet honored, and the route param is `$appId` while the legacy client posts to `/update/:appname` — id-vs-name mismatch to resolve.
2. **No auth at all.** No API-key check on the update route, no UI login.
3. **No delete-app flow.** The edit form renders an empty `intent=delete` Button but there's no server function or repository delete.
4. **No public status API.** Legacy `GET /apps` and `GET /status/:name` have no equivalent (only the internal `loadAppsFunc` server function).
5. **Not wired into the CLI.** `packages/cli` still bundles `@gueterbahnhof/server`; server-tanstack is a standalone dev app (`pnpm start` → custom-server.js). No commander integration, no `--app-dir/--port/--api-key` flags; config went flags→env (`GUETERBAHNHOF_APP_DIR` → `GUETERBAHNHOF_DIR`).
6. **Landing page is still the TanStack template** (`routes/index.tsx`), plus template leftovers (README, demo files, `hello-server.js`).
7. **No config migration.** Legacy `apps.json` (keyed by name, field `entry`) → per-app `<id>.json` (field `script`) needs a one-time migration story.
8. **App state in the UI is static.** `listApps` snapshots pm2 status per request; the event bus exists but no live updates reach the browser, and there's no `no-entry`-style "config exists but nothing deployed" signal.

## Dead code / oddities noticed along the way
- `packages/common/App.ts` (`Service` with `hostname`, `target`, `tlsCert/tlsKey`) is imported nowhere — leftover from a reverse-proxy idea that died over SSL handling. Decided (2026-08-04): will not be revived; delete `App.ts` during the migration.
- `appConfigDb.getAppConfig` contains a workaround deleting a "mysterious 'io'" env key.
- Legacy `postArtifact` sends a `check=true` form field the server never reads.

## Terminology drift to settle before migrating (tracked in CONTEXT.md)
- `entry` (legacy, domain term) vs `script` (tanstack, pm2's word) for the same concept.
- Apps keyed by `name` (legacy) vs `id` + display `name` (tanstack).
- `app-service.ts#createService` says "service" where everything else says "app".

## Decisions (grilling session, 2026-08-04)

All open questions from the survey were resolved. This list is the input for the spec.

### Deploy contract
1. Deploy stays **by name**: `POST /update/:appname`. Existing CLI + Action keep working. App names must be unique — enforce on save in the UI.
2. **No auto-create**: unknown name → 400.
3. **Async two-endpoint design** (see ADR-0001): upload responds 202 + `{ deploymentId }`; progress at `GET /update/:appname/status` (echoes the deployment id). Deployment lifecycle: `extracting → starting → succeeded | failed`.
4. **409** while a deployment is in flight for the same app — at most one active per app.
5. Deployment state **in-memory, last N per app**; 404 for unknown ids/apps after restart.
6. CLI: **fire-and-forget by default**, `--wait` flag polls to a terminal state and exits non-zero on failure. The GitHub Action sets `wait: true`.

### Server
7. **One API key, enforced properly**: authorization header on every API route; UI login exchanges the key for a signed, verified httpOnly session cookie. (Legacy enforcement was broken — check-inside-handler and presence-only cookie guard.)
8. **No-daemon pm2 stays** (see ADR-0002): dies together, wipe on SIGTERM. gueterbahnhof updates = downtime for all apps, accepted.
9. Config format: per-app `<id>.json` + optional `<id>.env` sidecar (as built), but field **`script` → `entry`** (domain term; pm2's `script` only at the pm-service boundary).
10. **Auto-migrate on boot**: detect legacy `apps.json`, mint ids, write per-app files, rename to `apps.json.migrated`.
11. Public API: minimal **`GET /apps`** returning `{id, name, state}[]`, key-protected. Legacy `GET /status/:name` (raw pm2 describe) is dropped.

### Packaging & UI
12. server-tanstack **replaces `@gueterbahnhof/server` inside the published CLI** (`@lamsal-de/gueterbahnhof`): commander flags `--app-dir/--port/--api-key` with env fallbacks, port default 4444, env var `GUETERBAHNHOF_APP_DIR`, interactive dir prompt replaced by create-or-fail-fast.
13. UI status via **SSE from the pm2 event bus** (app-state-service gets its consumer), plus derived **"no artifact"** state when the app dir is missing (legacy `no-entry` equivalent).
14. **Delete = full cleanup**: stop+delete pm2 process, delete config + env sidecar + extracted app dir, confirm dialog in UI.
15. `common/App.ts` deleted (dead reverse-proxy idea, not revived); TanStack template leftovers (landing page, README, demo files, `hello-server.js`) cleaned up.

Next step: `/to-spec` → `.scratch/server-tanstack-migration/spec.md`.

## Migration completed (2026-08-04)

All tickets 01–10 implemented on `feat/server-tanstack`. Gap list re-checked:

1. Deploy endpoint stub → real async deploy (tickets 02/03, ADR-0001)
2. No auth → API key + verified session cookie (04)
3. No delete-app → full cleanup with confirm (06)
4. No public status API → `GET /apps` (07)
5. Not wired into CLI → packaged nitro output ships in the bin (09)
6. Landing page template → `/` redirects to the app list; template leftovers, `custom-server.js`, `hello-server.js` deleted (10)
7. No config migration → auto-migration incl. artifact-dir moves (08)
8. Static app state → SSE live updates + `no-artifact` state (07)

Dead code: `packages/server` and `packages/common` deleted entirely (nothing consumed `ServerConfig` anymore); the `check=true` client field and the `'io'` env workaround died with their owners. Terminology: `entry`, `createApp`, apps keyed by `id` with unique `name` — all per CONTEXT.md.

## Comments
