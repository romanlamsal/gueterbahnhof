# 08 — pm2 daemon mode: revisit ADR-0002

Type: grilling
Status: resolved
Blocked by: none — can start immediately

## Question

Should gueterbahnhof stop running pm2 in no-daemon mode (`pm2.connect(true)`, ADR-0002) and connect to a real external pm2 daemon instead?

This reframes most of the map, because it removes a constraint rather than working around it.

**What it would fix:**

- **The shared-instance problem dissolves.** With an external daemon the fleet's state lives in the daemon behind its RPC socket, not in a module object. Any number of clients — the CLI process, the built server, two module instances, separate processes entirely — talk to the same daemon. Module identity stops mattering, so ticket 07's stateless/stateful split largely evaporates.
- **Eager boot becomes trivial.** The CLI can connect, migrate and start the whole fleet before the server module is ever evaluated; the server later connects its own client for deploys and sees the same apps. No nitro plugin, no chunk-path hardcoding, no preset change — ticket 04 mostly dissolves.
- **gueterbahnhof updates stop taking the fleet down.** This is exactly the production incident: the server crashed and every managed app died with it, because they were its children.

**What it would cost:**

- It **reverses ADR-0002**, whose rationale was a single process tree with nothing stray: a pm2 daemon would outlive gueterbahnhof by design.
- **Two sources of truth** — our per-app config files versus the daemon's own process list and dump. Boot needs a reconciliation policy: start what's configured and missing, and decide what to do with running processes that no longer have a config (orphans from an older version, or another user's).
- **Daemon version drift** across upgrades: a daemon started by a different pm2 version generally needs killing before the new client can drive it.
- **Deleting an app** must now stop a process that would otherwise keep running forever.
- **Shutdown semantics invert:** the SIGTERM/SIGINT wipe must *not* run any more, or updates would still kill the fleet.

**Decide:**

1. Daemon mode or no-daemon — and if daemon, does ADR-0002 get superseded by a new ADR (not edited in place)?
2. Who owns the daemon's lifecycle: does gueterbahnhof start it when absent, and does it ever kill it?
3. What does boot reconcile — configured-but-not-running, running-but-not-configured, running-with-stale-env?
4. Which pm2 provides the daemon binary, given ticket 03's answer (installed dependency vs shipped copy)? A client and daemon from mismatched copies is a real failure mode.
5. Does anything still need to be eager *inside* the server module afterwards, or does the CLI own the whole lifecycle?

## Answer

**Connect to an external pm2 daemon.** ADR-0002 is superseded — a new ADR gets written during implementation, not an edit in place.

1. **Daemon, not no-daemon.** Fleet state lives behind pm2's RPC socket, so several clients (the CLI process, the server module) drive one fleet and module identity stops mattering.
2. **Auto-spawn, never kill.** `pm2.connect()` starts the daemon when absent. gueterbahnhof never calls `pm2 kill` — that daemon may hold processes that aren't ours.
3. **The fleet still dies with the server — but only the fleet.** Graceful shutdown stops and deletes *our* apps; the daemon and any foreign processes survive. The existing `wipeAllApps` is already correctly scoped (it iterates our own configs). Consequence to accept knowingly: an *ungraceful* death (crash, SIGKILL) now leaves our apps running under the daemon until gueterbahnhof returns — and boot recreates them anyway per (6).
4. **Ownership via a dedicated pm2 namespace** — start every app with `namespace: "gueterbahnhof"` (currently omitted from `AppProcessSpec` in `pm2-process-manager.ts`). Name collisions with foreign processes become harmless and "only the fleet" becomes structural rather than a naming convention. The namespace's `describe`/`stop`/`delete` semantics must be verified during implementation.
5. **PM2_HOME: default to the shared `~/.pm2`, honour an explicit one.** Apps then appear in the operator's normal `pm2 list` / `pm2 logs`. If `PM2_HOME` is set in gueterbahnhof's environment we respect it and the daemon we spawn inherits it — setting that env var is the supported way to get a fully isolated daemon, so no extra flag is needed. Implementation must not sanitise or drop `PM2_HOME` when connecting or when spawning app processes.
6. **Boot always recreates: stop → delete → start** every configured app, whatever state it is found in. Rationale from operational experience: a plain restart can leave stale environment variables on the process, so delete-then-start is the only way to guarantee the running fleet matches the configured state — the same reasoning `decideRestart` already encodes for env changes, promoted to boot policy. Processes in our namespace with no config are stopped and deleted. Accepted cost: app downtime on every gueterbahnhof restart.
7. **Nothing needs to be eager inside the server module.** The CLI owns the lifecycle — app-dir creation, migration, reconciliation, signal handlers — and the server module opens its own pm2 client when it first needs one (deploys, and `launchBus` for the SSE stream), both of which are request-driven by nature.

**Effects on the map:** tickets 07 and 04 are subsumed by this decision and resolved. Ticket 03 gains a constraint — the client that spawns the daemon and the client the server uses should be the same pm2 copy/version, or the daemon will refuse the mismatched client. The fog entries about nitro's eager-startup mechanisms and about sharing a pm2 module instance are moot and have been removed.

## Correction (2026-08-05, during implementation)

Decision 4 above — "ownership via a dedicated pm2 namespace" — **rests on a false premise and is withdrawn**. Verified in the installed pm2 6.0.14:

- `Client.prototype.getProcessIdByName` (`lib/Client.js:678-700`) matches on `proc.pm2_env.name == name` (or a resolved script path) with **no namespace filter**.
- `API._operate`, which backs `stop`/`delete`/`restart`, calls `getProcessIdByName` **first** and only falls back to `getProcessIdsByNamespace` when no name matched (`lib/API.js:1551-1575`).
- `describe` resolves through the same name lookup.

So on the shared `~/.pm2`, a name-addressed operation reaches every process with that name in any namespace. A namespace groups and displays; it does not protect. Everything else in this ticket's answer stands — the replacement ownership mechanism is decided in [09](09-fleet-ownership-mechanism.md).
