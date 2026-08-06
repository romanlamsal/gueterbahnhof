# 01 — Stop pm2's shape at the Process Manager seam

Type: grilling
Status: resolved
Blocked by: none — can start immediately

## Question

`type ProcessManager = typeof pm2ProcessManager` makes the interface *be* the implementation, so pm2's own types are the contract. What should the hand-written interface say instead?

Evidence:

- `interface-services/pm2-process-manager.ts:166` — the port is inferred from the adapter.
- `app-services/app-service.ts:76` reads `procDescription?.pm2_env?.status`; `:44` filters names only because pm2 types `name` as optional.
- `app-services/app-service.test.ts:59` casts all three dependencies `as never`; `deployment-service.test.ts:45` casts `as unknown as Parameters<…>`. Fakes cannot structurally satisfy the inferred type, so nothing type-checks them.
- `domain/app-state.ts:5` already takes a plain status string — only the last hop is missing.

Decide:

1. What the interface returns — a `{ name, status }` record, an App State directly, or something else. Note that `listFleetProcesses` and `getAppProcess` have different callers with different needs.
2. Whether the adapter keeps returning pm2's `Proc` from start/stop/delete, or narrows those too (the callers only check truthiness).
3. Whether `startAppProcess` stops conflating "no Entry configured" with "pm2 refused" — today both are `undefined`, so `deployment-service.ts:65-73` re-guards Entry itself to keep the two reasons apart.

Then land it: the fakes in both test files should type-check without a single cast.

## Answer

The port is now hand-written in `interface-services/process-manager.ts`; `pm2-process-manager.ts` declares `: ProcessManager` and satisfies it.

1. **Reads return `ManagedProcess = { name, status }`** — the same record from `getAppProcess` and `listFleetProcesses`. `status` stays a plain string, which `deriveAppState` already accepts and already treats unknown values as stopped. `app-service` no longer touches `pm2_env`, and the `filter((name): name is string => …)` that existed only because pm2 types `name` as optional is gone.
2. **Writes return `ProcessOutcome = { ok: true } | { ok: false; reason }`.** Chosen over a boolean so a failed deploy can report what the Process Manager actually said instead of a constant — `deployment-service` now fails with `The app did not start: <reason>`.
3. **"No Entry configured" is the adapter's reason**, not a caller's pre-check. `startAppProcess` returns that outcome, `deployment-service`'s duplicate guard is gone, and `reconcileFleet` now warns per App that did not start instead of silently under-counting.

**Every cast in the app-service and deployment-service tests is gone** — the fakes satisfy the port structurally, which was the whole point. 129 tests pass, typecheck and biome clean.

**Surfaced:** the same disease affects the other two ports — `AppConfigRepository` and `ArtifactStore` are both `ReturnType<typeof create…>`, so the config-repository fake still needs one cast. Charted as [09 — The other two ports are inferred too](09-remaining-inferred-ports.md).
