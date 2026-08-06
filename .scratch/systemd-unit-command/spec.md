# Spec: `gueterbahnhof systemd` and a Server Config file

Status: ready-for-agent

Decided in a grilling session on 2026-08-06. Grew out of the packaging map's last open question (reboot survival) plus a real pain point: the production host runs a hand-written user unit invoking a `start-gueterbahnhof.sh` wrapper whose only job is to hold `API_KEY` and a home path.

## Problem

Reboot survival is currently folklore — a unit typed by hand, referencing a wrapper script that exists to smuggle in secrets. Three faults in the current arrangement:

1. The unit runs `pm2 start … start-gueterbahnhof.sh` with `Type=simple`. `pm2 start` is a client command that exits as soon as the daemon accepts the app, so systemd sees the main process exit and `Restart=always` re-runs it every `RestartSec`. The unit flaps.
2. The pm2 app is named `gueterbahnhof`, colliding with the fleet's namespace label of the same name. pm2 resolves names before namespaces, so `pm2 stop gueterbahnhof` stops the server rather than the fleet — the manual bulk lever from the packaging map's ticket 09 points at the wrong thing.
3. Secrets live in a shell script purely because there was no better mechanism.

## Solution

A `gueterbahnhof systemd` command that prints a correct unit, plus a Server Config file so nothing needs smuggling through a wrapper.

### Decisions

1. **The server runs directly under systemd.** `ExecStart` invokes the gueterbahnhof binary itself; systemd provides restart-on-crash and log capture (`journalctl --user -u gueterbahnhof`). Removes the flapping unit, ends the supervisor-inside-a-supervisor arrangement, and frees the name `gueterbahnhof` so the namespace lever works. Accepted trade: logs move from `pm2 logs gueterbahnhof` to journalctl.
2. **Server Config comes from `~/.gueterbahnhof`**, overridable with `--config`. Precedence: **flag → environment variable → config file**.
3. **The file is dotenv with `GUETERBAHNHOF_*` keys.** Same shape the app configs already speak, same parser already shipped, no new dependency — and a file of `GUETERBAHNHOF_APP_DIR=…` lines is simultaneously a valid systemd `EnvironmentFile`, so the same file works whichever mechanism reads it.
4. **The generated unit sets `KillMode=process`.** gueterbahnhof auto-spawns the pm2 daemon, which lands in the unit's cgroup; systemd's default `control-group` would SIGKILL the daemon and every app — ours and foreign — on stop, discarding the boundary ADR-0003 establishes. With `KillMode=process` systemd signals only gueterbahnhof, whose own handler stops the fleet gracefully. Paired with a `TimeoutStopSec` generous enough for that stop.
5. **User unit by default**, with install guidance printed to stderr — including `loginctl enable-linger`, without which a user unit does not start at boot at all. The command reads and reports current linger state, since that is a one-line check and the difference between "survives reboot" and "survives login".

### Implementation notes

- **Config loading is nearly free.** Every flag already defaults to `process.env.GUETERBAHNHOF_*`. So parse `~/.gueterbahnhof` with dotenv and write only the keys *not already set* into `process.env`, before cleye parses argv. Flag → env → file precedence falls out with no per-flag wiring, and it applies to `deploy` as well as `server`.
- **Keys** are the existing variables: `GUETERBAHNHOF_APP_DIR`, `GUETERBAHNHOF_PORT`, `GUETERBAHNHOF_API_KEY`, plus `GUETERBAHNHOF_HOST` / `GUETERBAHNHOF_APP_NAME` / `GUETERBAHNHOF_WAIT` client-side. `PM2_HOME` is honoured when present but is not ours to define.
- **Warn on loose permissions** when the file carries an API key and is group- or world-readable. Warn, don't refuse.
- **`ExecStart` must be an absolute path** to the installed binary, resolved at generation time rather than assumed.
- The unit carries short comments explaining `KillMode=process` (pointing at ADR-0003) so nobody later "tidies" it into breaking the daemon boundary.
- Migration on the host: write `~/.gueterbahnhof` (`GUETERBAHNHOF_APP_DIR`, `GUETERBAHNHOF_PORT`, `GUETERBAHNHOF_API_KEY`) at mode 600, regenerate the unit, `systemctl --user daemon-reload`, then delete `start-gueterbahnhof.sh` — everything it set is covered by the config file.

### Testing

- Config loader: real files in tmpdirs (missing file, comments, quoted values, values containing `=`, precedence against a pre-set env var, permission warning).
- Unit generation: a pure function from resolved Server Config to unit text, asserted on what matters (`ExecStart` absolute, `KillMode=process`, `Restart`, `WantedBy=default.target`) so no systemd is needed in tests.
- No new ADR: the reversible bits are unremarkable, and the one surprising choice is documented in the generated unit and traceable to ADR-0003.

## Out of scope

- Installing or enabling the unit — the command prints, the operator installs.
- A `--system` variant; user units match how this host is set up.
- Migrating the existing hand-written unit automatically.
