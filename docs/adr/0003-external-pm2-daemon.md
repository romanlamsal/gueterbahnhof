---
status: accepted (supersedes ADR-0002; amended by ADR-0006)
---

# An external pm2 daemon owns the fleet, and the CLI owns the lifecycle

Gueterbahnhof connects to a real pm2 daemon (`pm2.connect()`, auto-spawned when absent) instead of running one in-process. Fleet state therefore lives behind pm2's RPC socket rather than inside a module instance, so several clients — the CLI process and the built server — drive one fleet, and the **CLI owns the lifecycle**: it creates the app directory, migrates a legacy config, connects, reconciles the fleet and installs the signal handlers *before* it starts listening. The server module does no boot work at all; it opens its own pm2 client on demand (deploys, and the SSE event bus on first subscriber).

This replaces ADR-0002's no-daemon mode, whose in-process daemon made two module instances impossible to reconcile and coupled every managed app to the server's own survival.

## Consequences

- **Gueterbahnhof no longer needs anything to be eager inside the built server.** Boot used to be module side effects that nitro only reached on the first SSR render, so a freshly started server listened without ever connecting pm2, migrating or starting a single app. That class of bug is gone: the CLI runs boot itself and exits non-zero if it fails.
- **We never call `pm2 kill`.** The daemon may be supervising processes that aren't ours.
- **Our apps still go down with us, but only ours.** On SIGTERM/SIGINT the CLI stops and deletes the apps it has configs for; the daemon and any foreign process keep running. An *ungraceful* death (crash, SIGKILL) now leaves our apps running until gueterbahnhof returns.
- **Boot recreates, it never restarts.** Every configured app is stopped, deleted and started again, because pm2 keeps the environment a process was started with and a plain restart can silently run an app with stale env. Processes carrying our namespace label with no config are reclaimed. The cost is app downtime on every gueterbahnhof restart, which is accepted.
- **`PM2_HOME` is honoured if set** and inherited by the daemon we spawn, so setting that variable is the supported way to run a fully isolated daemon. We never sanitise it.
- **The `gueterbahnhof` namespace is a label, not a boundary** — see ADR-0004.
