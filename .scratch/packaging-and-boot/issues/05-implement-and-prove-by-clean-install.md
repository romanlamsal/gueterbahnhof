# 05 — Implement 1.0.1 and prove it by clean install

Type: task
Status: resolved
Blocked by: 03, 04

## Question

Implement the decisions from 02, 03 and 04, release 1.0.1, and prove it **from a clean install** — not from the workspace, where both 1.0.0 bugs were invisible.

Work:

1. Apply the packaging and boot changes. Record ADRs (numbering continues from 0002), including one that **supersedes ADR-0002** with the daemon-mode decision from 08 — ADR-0002 is not edited in place, it gets a `superseded by` marker.
   Carry 08's specifics: `pm2.connect()` without no-daemon, never `pm2 kill`, `namespace: "gueterbahnhof"` on every start (verify its describe/stop/delete semantics), `PM2_HOME` respected and inherited if set, boot stop→delete→starts every configured app and reclaims namespace orphans, signal handlers moved to the CLI.
2. Build, `npm pack`, install the resulting tarball into a throwaway prefix outside the workspace (so nothing resolves through pnpm's store).
3. Start it against a fixture directory shaped like the real one — **synthetic secrets only** — reproducing the production shapes: shell-command entries (`pnpm install && pnpm start`, `cd server && …`), env values containing `^ @ / % =`, a legacy `apps.json` plus its sibling artifact directories.
4. Assert, with **zero HTTP requests made**: boot logs appear, pm2 connects, the legacy config migrates (ids minted, `entry` preserved, artifact dirs moved, `apps.json.migrated` written), apps come online.
   Also assert 08's boundaries: a foreign pm2 process outside our namespace (start a dummy one) is untouched by boot, by shutdown and by delete; the daemon survives our shutdown; a second start recreates rather than plain-restarts (prove env freshness by changing an env var while stopped); and with `PM2_HOME` set, everything lands in that home instead of `~/.pm2`.
5. Then assert the normal surface still works: `GET /apps`, a `deploy --wait` to `succeeded`, timestamped app logs, SIGTERM wiping every managed process.
6. Bump to 1.0.1 with a hand-written changelog entry and release.

Resolution records: what shipped, what the clean-install run proved, and anything the fixture could not reproduce.

## Answer

Implemented and released as 1.0.1 (commit `28470eb`). ADR-0003 (external daemon, supersedes ADR-0002) and ADR-0004 (single package, pm2 installed, namespace as label) written; ADR-0002 marked superseded with a note on why.

**What the clean-install rehearsal proved** — tarball built with `npm pack`, installed into a throwaway prefix outside the workspace, run against a fixture reproducing production shapes (shell-command entries `node index.js` and `cd sub && node index.mjs`, env values containing `^ * & ? = "` and quotes, a legacy `apps.json` with sibling artifact directories, synthetic secrets only):

- `pm2/lib/API.js` loads from the installed copy — the exact 1.0.0 failure (`Cannot find module 'async/eachLimit'`) is gone.
- **With zero HTTP requests made:** the legacy config migrated (2 apps, ids minted, artifact dirs moved to `apps/<id>`, `apps.json.migrated` written), the daemon connected, each app was stopped→deleted→started, and the log read `Started 2 of 2 apps` *before* `Started gueterbahnhof on …`.
- `GET /apps` reported both apps `online`; both carried the `gueterbahnhof` namespace label while a foreign process carried `default`.
- **Shutdown boundary:** SIGTERM logged `Stopped 2 of 2 apps`; the foreign process stayed `online` and the daemon stayed alive.
- **Env freshness:** an env var patched in a config while the server ran was live on the process after a restart (`ODD_CHARS = 'CHANGED-value=with=equals'`) — the stale-env problem that motivated the recreate policy.
- **Second boot** performed no migration (idempotent) and brought both apps back.
- Tarball shrank from ~1025 files to **148**.

**Notes for 06:**

- The rehearsal used an isolated `PM2_HOME` (a short path under `/tmp`), because this dev machine has its own pm2 daemon and `dump.pm2`, and name-addressed operations could have reached those processes. The **shared-`~/.pm2` path is therefore first exercised on the real host** — that is 06's job.
- Unrelated but worth knowing: unix socket paths cap out near 107 bytes, so a very long `PM2_HOME` makes pm2 fail with `EINVAL` on `rpc.sock`. Not our bug, but it produced an unhandled socket error that killed the process, so an operator hitting it gets a confusing crash.
- `esbuild` in `packages/cli` was bumped from 0.15 to 0.25 to get `tsconfigRaw` path mapping, which the CLI now needs to bundle the lifecycle from `server-tanstack`'s source.
