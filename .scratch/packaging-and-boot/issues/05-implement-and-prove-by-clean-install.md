# 05 — Implement 1.0.1 and prove it by clean install

Type: task
Status: claimed
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
