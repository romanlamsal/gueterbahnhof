# 03 — Make the App State bus a factory, absorbing the typed emitter

Type: grilling
Status: resolved
Blocked by: none — can start immediately

## Question

`kit/typed-event-emitter.ts` is 88 lines with one caller, and 44 of them are an `EventTarget` branch guarded by `typeof window !== "undefined"` — unreachable in a module whose first line is `import pm2`. Its `off()` has no caller in either branch. Meanwhile `interface-services/app-state-service.ts` is exported as an *instance* holding module state (`busSubscription`, `lastKnownState`), so it has no test, and `controllers/events-controller.ts:8` writes `Pick<typeof appStateService, …>` — importing the singleton merely to name its shape.

Decide:

1. The factory's signature — what gets injected so the bus is testable without pm2. `createAppStateService({ launchBus })` is the obvious shape; confirm what else it needs.
2. Whether the zod schema survives. It currently re-validates events this module just constructed itself.
3. What the controller names instead of `typeof appStateService` — an exported interface, or a structural type it declares itself.

Then land it: the emitter file goes, the state moves into the closure, and the bus gets its first test with a fake `launchBus`.

## Answer

1. **A narrow `ProcessEvents` port is injected**, not pm2's `launchBus`. `interface-services/process-events.ts` declares one method — subscribe, receive `{ name, status }` — and `pm2-process-events.ts` adapts pm2's bus to it. Injecting `launchBus` would have made every fake impersonate pm2's bus and event shapes, which is exactly the leak ticket 01 closed.
2. **Validation moved to the pm2 edge.** The zod schema now lives in the adapter, where the payload genuinely is untrusted, and parses pm2's `{ process: { name, status } }` into a `ProcessStateChange`. The bus receives only well-formed changes, so it needs no schema — and with the schema went the typed emitter's reason to exist.
3. **The controller names `AppStateBus`**, an exported interface, instead of `Pick<typeof appStateService, …>`. It no longer imports a singleton to describe a shape.

`createAppStateBus({ processEvents })` holds its subscription and its memory of the last known state in a closure. `kit/typed-event-emitter.ts` is deleted — 88 lines, 44 of them an `EventTarget` branch that could never run — and the `kit/` directory with it.

**The bus has tests for the first time**: forwarding, idempotent init, suppression of repeats, per-App tracking, abort-signal cleanup, and retry after a failed subscription. Six tests, each three lines of fake.

Verified live as well, since SSE wiring has now changed three times: deploying to a fresh app produced `launching` then `online` frames through the new port, and `GET /apps` agreed.

135 tests, typecheck and biome clean.
