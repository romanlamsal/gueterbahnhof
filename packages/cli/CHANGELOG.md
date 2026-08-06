# @lamsal-de/gueterbahnhof

## 1.2.0

### Minor Changes

-   **`gueterbahnhof logs`** — one place to read logs again, after running the server under systemd split them between journalctl and pm2. With no argument it tails the server's unit; with an app name it tails that app. `-n/--lines` (default 100), `-f/--follow` and `--errors` map onto both backends, and anything after `--` is forwarded raw, so `logs -- --since yesterday` or `logs my-app -- --raw` work without the command having to model two CLIs. `--unit` covers a differently named unit file, and pm2 is resolved from gueterbahnhof's own dependency so the client always matches the daemon it talks to.

-   **Errors are now distinguishable in the journal.** systemd records a service's stdout *and* stderr at priority info unless a line begins with a syslog prefix, so `journalctl -p err` used to show nothing at all. When `JOURNAL_STREAM` is set — systemd's signal that it owns our output — `console.error` and `console.warn` emit `<3>` and `<4>`. `journalctl -p err` and the colouring in `systemctl status` now work, and a plain terminal run is unaffected.

## 1.1.0

### Minor Changes

-   **`gueterbahnhof systemd`** prints a systemd user unit for running the server — unit to stdout, install guidance to stderr, so `gueterbahnhof systemd > ~/.config/systemd/user/gueterbahnhof.service` is the whole install. It resolves the binary path itself, never embeds your API key, and reads back your `loginctl` lingering state, without which a user unit does not start at boot at all.

    The generated unit runs the binary directly rather than through pm2, and sets `KillMode=process` with the reason inline: gueterbahnhof auto-spawns the pm2 daemon into the unit's cgroup, so systemd's default would SIGKILL that daemon along with every app it supervises — including processes gueterbahnhof never configured (ADR-0003).

-   **Server Config can live in a file.** `~/.gueterbahnhof` (overridable with `--config`) is dotenv with the existing `GUETERBAHNHOF_*` keys, so no more wrapper scripts holding secrets. Precedence is flag → environment → file, it applies to `deploy` as well as `server`, and the same file doubles as a systemd `EnvironmentFile` if you prefer that route. A warning is printed when a file holding a secret is readable by others.

## 1.0.1

### Patch Changes

-   **1.0.0 could not run at all — this fixes it.** Two bugs, both invisible in the workspace and only visible after a real `npm install`:

    -   **pm2 was unresolvable.** Nitro traces externalised dependencies into `.output/server/node_modules` as a content store plus symlinks; `npm pack` ships the files but silently drops the symlinks, so pm2 arrived without its `async` dependency and every start died with `Cannot find module 'async/eachLimit'`. pm2 is now a declared dependency (`^6.0.14`) installed by npm, and the traced copy is discarded from the tarball — which also shrinks it from ~1025 files to ~150. See ADR-0004.
    -   **Boot never ran.** The startup sequence lived as module side effects inside the built server, which nitro only reaches on the first page render — so a freshly started server listened without connecting pm2, migrating a legacy config or starting a single app. The CLI now owns the fleet's lifecycle and runs it before it starts listening, exiting non-zero if it fails.

-   **pm2 runs as a real daemon instead of in-process** (ADR-0003, superseding ADR-0002). Fleet state lives behind the daemon's socket, so the CLI and the server can both drive it. We auto-spawn the daemon and never `pm2 kill` it — it may hold processes that aren't ours. A graceful shutdown still stops our own apps and only ours; an ungraceful death now leaves them running until gueterbahnhof returns.
-   **Boot recreates rather than restarts.** Every configured app is stopped, deleted and started again, because pm2 keeps the environment a process was started with and a plain restart can silently run an app with stale env. Labelled processes with no config are reclaimed.
-   **`PM2_HOME` is honoured** if set, and inherited by the daemon we spawn — setting it is the supported way to run a fully isolated daemon.
-   Managed apps now carry a `gueterbahnhof` pm2 namespace as a grouping label, so `pm2 list` shows the fleet together and `pm2 stop gueterbahnhof` works as a manual lever. It is explicitly not an isolation boundary: pm2 resolves names across namespaces, so a foreign process sharing an app name would be affected — an accepted trade for `pm2 logs <app>` working out of the box.

## 1.0.0

### Major Changes

-   Rewrite the server as a TanStack Start app and ship it inside the CLI.

    -   Deploys are asynchronous (ADR-0001): `POST /update/:appname` responds `202 { deploymentId }`, progress at `GET /update/:appname/status` (optionally `?deploymentId=`). At most one deployment in flight per app (409).
    -   `gueterbahnhof deploy` gains `--wait` (env `GUETERBAHNHOF_WAIT`); the GitHub Action gains a `wait` input defaulting to `true` so CI fails on failed deploys.
    -   Auth enforced properly: API key on every management route; the UI logs in with the key and gets a signed, verified session cookie.
    -   New UI (React/shadcn): live app states over SSE, dotenv editing, unique app names, delete with full cleanup, distinct "no artifact" state.
    -   Legacy installs migrate automatically on first boot (`apps.json` → per-app configs, artifact dirs moved); the legacy file is renamed to `apps.json.migrated`.
    -   Config field `script` is now `entry`; apps have a stable `id` alongside their unique `name`.
    -   App logs are timestamped (`YYYY-MM-DD HH:mm:ss`) via pm2's `log_date_format`.
    -   The UI's dotenv editor round-trips npm dotenv's quoting/comment/multiline rules and can read and write URI-safe serialized values ("Escaped" mode).
    -   Breaking: raw pm2 describe output (`GET /status/:name`) is gone — use `GET /apps`; the server package is no longer published separately.

## 0.2.2

### Patch Changes

-   fix(server): set cwd to app's directory first before starting and reloading

## 0.2.1

### Patch Changes

-   a902d0a: Read env variables in client cli as substitutes for flags

## 0.2.0

### Minor Changes

-   14d766a: Switch to changesets. Yay!
