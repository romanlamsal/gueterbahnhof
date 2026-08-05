# 05 — Implement 1.0.1 and prove it by clean install

Type: task
Status: open
Blocked by: 03, 04

## Question

Implement the decisions from 02, 03 and 04, release 1.0.1, and prove it **from a clean install** — not from the workspace, where both 1.0.0 bugs were invisible.

Work:

1. Apply the packaging and boot changes; record the two decisions as ADRs (numbering continues from 0002).
2. Build, `npm pack`, install the resulting tarball into a throwaway prefix outside the workspace (so nothing resolves through pnpm's store).
3. Start it against a fixture directory shaped like the real one — **synthetic secrets only** — reproducing the production shapes: shell-command entries (`pnpm install && pnpm start`, `cd server && …`), env values containing `^ @ / % =`, a legacy `apps.json` plus its sibling artifact directories.
4. Assert, with **zero HTTP requests made**: boot logs appear, pm2 connects, the legacy config migrates (ids minted, `entry` preserved, artifact dirs moved, `apps.json.migrated` written), apps come online.
5. Then assert the normal surface still works: `GET /apps`, a `deploy --wait` to `succeeded`, timestamped app logs, SIGTERM wiping every managed process.
6. Bump to 1.0.1 with a hand-written changelog entry and release.

Resolution records: what shipped, what the clean-install run proved, and anything the fixture could not reproduce.
