# 08 — Release

Type: task
Status: resolved
Blocked by: 01, 02, 03, 04, 05, 06, 07, 09

## Question

Cut the patch release that closes this map.

- Full workspace green: typecheck, every test suite, biome, and the packaged build.
- A changelog entry that says plainly this is internal — interfaces and testability, no observable change — so nobody upgrades expecting a fix.
- Squash, push, and confirm the publish workflow.

Record in the answer which findings landed, which were ruled out of scope, and anything the map's fog turned into a real problem.

## Answer

**Released as 1.3.1.** All seven review findings are addressed: six refactored in (tickets 01, 02, 03, 04, 05, 07, plus 09 which the pass itself surfaced), one narrowed rather than honoured in full (ticket 06 — `decideRestart` became `needsRecreate`, with the three-way answer left out of scope because ADR-0003 would have to be reopened first). Nothing was dropped without a reason recorded on its ticket.

### What verification actually caught

Two things, neither of them predicted by the fog, and both worth the pass:

**The CLI package compiled the server's source under `strict: false`.** `packages/cli/tsconfig.json` maps `@/*` at server-tanstack's source and typechecks it with its own settings, which had strict off. Ticket 01's `ProcessOutcome = { ok: true } | { ok: false; reason: string }` narrows correctly under the server's config and fails under the CLI's — the same file, judged by two standards, one of which nothing else in the repo uses. Fixed by turning `strict` on in the CLI package, which is now consistent with everywhere else. That immediately surfaced two real gaps in the CLI's own code: `express` had no types (added `@types/express`), and the version lookup could return `undefined` and hand it to `readFileSync`, reporting a confusing error on a broken install — it now throws a clear one.

This is the map's one genuine finding beyond the review: a package that borrows another's source needs to borrow its strictness too, or the seam it was checking is only half-checked.

**Two lint nits** — a deferred-promise idiom in the App Config form test that tripped `noEmptyBlockStatements` and `noAssignInExpressions`, rewritten as an explicit deferred; and biome's config schema pinned a version behind the installed CLI.

### Green

- Typecheck: `server-tanstack`, `cli`, `client` — all clean.
- Tests: 139 + 29 + 9 = **177 passing**, 23 files.
- Biome: 101 files, clean.
- Build: `turbo build` clean; the bundle carries no controller import (ADR-0004 holds).

### Exercised against a packaged install

Not just built — packed with `npm pack`, installed into an empty directory outside the workspace, and run:

- `--version` and `--help` correct from the installed binary.
- The guard: 401 without a key, 401 with a wrong key, 200 with the right one. (First attempt showed 200 for all three — my probe used `x-api-key` and `API_KEY`, where the code reads the `authorization` header and `GUETERBAHNHOF_API_KEY`. The bypass was in the test, not the server.)
- A real deploy end to end: seeded App Config listed as `no-artifact`, `deploy --wait` reported success, the App went `online`, and the deployed process served traffic on its port with its Env applied.
- The shutdown contract from ADR-0003, with a bystander process started in the same daemon under the `default` namespace: on SIGTERM the App stopped, `Stopped 1 of 1 apps`, and both the bystander and the pm2 daemon kept running.

The isolated `PM2_HOME` was torn down afterwards; no pm2 ran inside the test suite.
