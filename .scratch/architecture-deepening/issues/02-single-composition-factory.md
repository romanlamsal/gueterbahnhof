# 02 — One factory behind both composition roots

Type: task
Status: resolved
Blocked by: 01

## Question

`runtime/services.ts:25-44` and `runtime/lifecycle.ts:14-23` wire the same object graph twice — repository, artifact store, app service over the pm2 adapter — with two spellings of the `<dir>/apps` convention and two lifetimes (memoised for the server, fresh per call for the CLI).

Collapse them to a single `createServices(gueterbahnhofDir)` that both call, with `services.ts` supplying the directory from `getEnv()` and keeping only the memoisation the server wants.

Constraint from ADR-0003: the CLI bundle imports `lifecycle.ts` directly, so the factory must sit **below** the controllers — pulling the controller graph into the CLI bundle would undo the packaging work.

Blocked by 01 only because both touch the same wiring; landing them in the other order means doing the wiring twice.

## Answer

`runtime/create-services.ts` is now the one place the graph is wired — App Directory convention, config repository, artifact store, Process Manager, App service, Deployment service — and both roots call it:

- `runtime/services.ts` memoises a single `Services` and exposes the same getters as before, so no route or controller changed. It keeps the controllers, which only the server needs.
- `runtime/lifecycle.ts` builds one per boot for the CLI.

The two spellings of `<dir>/apps` are gone; `appsDir` comes from the factory. Five hand-rolled memo slots in `services.ts` collapsed to one.

**The ADR-0004 constraint holds and is now verified rather than asserted:** the factory imports nothing from `controllers/`, and grepping the built `dist/cli.js` for `createDeployController|createAuthController` returns 0 — the CLI bundle still carries no controller graph. Bundle size unchanged at 2.2M.

129 tests, typecheck and biome clean.
