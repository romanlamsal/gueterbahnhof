# 08 — pm2 daemon mode: revisit ADR-0002

Type: grilling
Status: open
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
