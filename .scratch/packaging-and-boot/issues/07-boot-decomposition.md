# 07 — Boot decomposition: CLI process vs server module

Type: grilling
Status: open
Blocked by: 08

## Question

Which parts of boot are **stateless** (runnable in the CLI process, before the server module is ever evaluated) and which are **stateful** (must run inside the same module instance that serves requests)?

Starting position, from reading the current code:

- **Stateless — candidates for the CLI:** app-directory creation and fail-fast; `migrateLegacyAppsJson` (pure fs, idempotent). `packages/cli` already depends on `server-tanstack`, so esbuild can bundle the migration into `cli.js`; the code would exist in two bundles but only ever run from one, and being stateless that duplication is harmless.
- **Stateful — must stay with the request handlers:** the pm2 connection (`connect(true)` runs the daemon in-process, and `deployment-service` drives it for deploys), `appStateService.init()` (the `launchBus` subscription and the emitter the SSE controller consumes), `startAllApps()`, and the SIGTERM/SIGINT wipe.

Decide:

1. Does migration move to the CLI, and is it then **removed** from `src/server.ts` or left in place as an idempotent second run?
2. How does the CLI reach the migration code — deep import of `server-tanstack` source (esbuild bundles it), or does the migration move somewhere shared?
3. **Verify the forcing constraint:** can the CLI and the built server share *one* pm2 module instance — the CLI leaving pm2 external so both resolve the same installed file, with Node's CJS cache shared between `require` and `import` of a CJS package? If they can, more of boot could move to the CLI and ticket 04 shrinks further. If they cannot, the split above is forced. Prove it with a small experiment rather than reasoning alone.

This ticket constrains 04: it decides how much eagerness is still needed from the server module at all.
