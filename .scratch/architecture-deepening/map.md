# Map: architecture deepening

Label: wayfinder:map

## Destination

The seven findings from the architecture review of 2026-08-06 are **all addressed and landed on main** — each one either refactored into the codebase or consciously dropped with the reason recorded — finishing with a single patch release. Nothing here changes what an operator can observe; the destination is reached when the interfaces are honest and the tests stop working around them.

## Notes

**Domain:** vocabulary in `CONTEXT.md` (App, Fleet, App Config, Server Config, Env, Entry, App State, Process Manager, Deployment). Binding decisions in `docs/adr/` — ADR-0001 (async deploy), ADR-0003 (external pm2 daemon, recreate-on-boot), ADR-0004 (single package, namespace as label only).

**Architecture vocabulary:** module, interface, implementation, depth, seam, adapter, leverage, locality — as used in the review. Don't drift into "service", "layer", "boundary".

**Skills:** `/grilling` + `/domain-modeling` for the decision tickets; `/codebase-design` when an interface needs designing twice.

**This map executes.** The destination is landed code, so each ticket decides *and* lands its finding in the same session, ending with tests, typecheck and biome green. That overrides wayfinder's plan-don't-do default.

**Standing constraints:** never run real pm2 in the test suite. No `gh` CLI in this repo. Keep the four-layer scheme — controllers → app services → domain → interface services — and don't let imports point upward.

**The review itself:** `/tmp/architecture-review-20260806-212550.html` (temp file, will not survive; findings are restated in the tickets).

## Decisions so far

<!-- one line per resolved ticket -->

- [Stop pm2's shape at the Process Manager seam](issues/01-process-manager-interface.md) — the port is hand-written: reads return `ManagedProcess { name, status }`, writes return `{ ok } | { ok: false, reason }`, and "no Entry configured" is the adapter's reason rather than a caller's pre-check. pm2's types no longer leave the adapter, and every cast in the two service test files is gone.
- [One factory behind both composition roots](issues/02-single-composition-factory.md) — `runtime/create-services.ts` wires the graph once; the server memoises it, the CLI builds one per boot. Verified in the built bundle that no controller followed the CLI in.
- [Make the App State bus a factory, absorbing the typed emitter](issues/03-app-state-bus-factory.md) — a narrow `ProcessEvents` port is injected instead of pm2's bus, validation moves to the pm2 edge, and the typed emitter is deleted. The bus has tests for the first time; SSE verified live.
- [Make an unguarded route visible](issues/04-guard-coverage.md) — a `guarded()` wrapper, tested once, applied to all four management routes; the controller resolves per request so routes stay importable. Route-level coverage was declined knowingly — a spike proved it is available if the risk ever bites.
- [Delete the two exports nothing calls](issues/05-delete-dead-exports.md) — `startOrReload` and `canStartDeployment` gone, the latter with the test that was its only caller; `isInFlight` carries those assertions instead.
- [Three answers, two behaviours](issues/06-decide-restart-interface.md) — `decideRestart` narrowed to `needsRecreate(prev, next): boolean`, the question the caller was already asking. Honouring the three-way answer stays out of scope, as ADR-0003 requires.
- [Move Env formatting into the domain](issues/07-env-formatting-into-domain.md) — `lib/dotenv-roundtrip.ts` is now `domain/env-format.ts`; `lib/` holds only shadcn's helper, so the layer scheme accounts for everything.
- [The other two ports are inferred too](issues/09-remaining-inferred-ports.md) — `AppConfigRepository` and `ArtifactStore` hand-written from what callers use; `getConfigPath` becomes a closure helper. The suite now holds zero casts. Services and controllers stay inferred deliberately: interface-service ports are the substitution seams, so only they are written by hand.

- [Release](issues/08-release.md) — 1.3.1, all seven findings addressed. Verification against a packaged install caught what the fog did not: the CLI package typechecked the server's source with `strict` off, hiding ticket 01's union narrowing and two real gaps in the CLI's own code. 177 tests, biome and the bundle green; guard, deploy and the ADR-0003 shutdown contract exercised on a clean install.

## Not yet specified

*(Cleared: a spike showed route modules import cleanly and their handlers are callable, so behavioural coverage was available after all — ticket 04 declined it in favour of testing the wrapper, with the spike's finding recorded there.)*
*(Cleared: removing the pm2 casts surfaced exactly one thing — the other two ports are inferred the same way, now charted as ticket 09.)*

## Out of scope

- Changing ADR-0003's recreate-on-boot policy. Ticket 06 may narrow `decideRestart`'s interface, but honouring a three-way answer — reintroducing plain restarts — would need that ADR reopened as its own effort.
- Rewriting the existing test suites; tickets adjust the tests their own change touches, nothing more.
- Any change to the deploy contract, the daemon lifecycle, or the published CLI surface.
