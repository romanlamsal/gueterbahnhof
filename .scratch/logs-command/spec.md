# Spec: `gueterbahnhof logs`

Status: implemented (1.2.0)

Decided in a grilling session on 2026-08-06, straight after [the systemd switch](../systemd-unit-command/spec.md) — which is what created the problem.

## Problem

Running the server directly under systemd split log reading in two: `journalctl --user -u gueterbahnhof` for the server, `pm2 logs <app>` for the apps. That was the acknowledged cost of dropping pm2 as the server's supervisor, but it leaves the operator remembering two tools and two flag vocabularies.

## Decisions

1. **`logs [app]` covers both.** No argument tails the server's unit via journalctl; an argument tails that app via pm2. The alternative — server-only, with a name like `server-logs` — was rejected because in a tool whose job is running apps, `gueterbahnhof logs scrumpoker` should do the obvious thing rather than error.
2. **`--errors` required a change to how the server logs.** See the finding below: it would otherwise have been a no-op.
3. **Flag surface: `-n/--lines` (default 100), `-f/--follow`, `--errors`, plus `--` passthrough.** Those three are the ones that map onto both backends; everything else (`--since`, `--grep`, `--raw`, `--output=json`) is forwarded raw so the command never has to model two CLIs or keep up with their changes.

Supporting choices: `--unit` defaults to `gueterbahnhof` since the unit's filename is the operator's to pick; the invocation is a pure options→argv function so the mapping is tested without journalctl or pm2 present; the child is spawned with inherited stdio and its exit code is propagated.

## Findings worth keeping

- **systemd records a service's stdout _and_ stderr at `PRIORITY=6` (info).** Probed directly with a transient unit: a plain stderr line came back at 6, and only a line starting with `<3>` came back at 3. So `journalctl -p err` showed nothing for gueterbahnhof, and "separate info from error" was impossible until the server started emitting syslog prefixes. It now adds `<3>`/`<4>` to `console.error`/`console.warn` when `JOURNAL_STREAM` is set — systemd's own signal that it owns our output — so a terminal run stays clean. Verified end to end: a real error from the binary under a transient unit lands at `PRIORITY=3` and `logs --errors` filters to exactly it.
- **`pm2 logs` matches on namespace, not just name** (`pm2/lib/API/Log.js:21` compares `packet.process.namespace == id`). Since the server stopped squatting on the name `gueterbahnhof` as a pm2 app, `pm2 logs gueterbahnhof` now streams the whole fleet — a free fleet-wide view, and a second use for the namespace label beyond `pm2 stop`.
- **`JOURNAL_STREAM` is set in the dev shell here**, because the terminal runs under a systemd user session. A first version of the prefix test passed for the wrong reason and never exercised the "not attached" branch; the module now takes `env` and `target` as parameters instead of reading globals. Worth remembering for anything else that branches on environment.

## Out of scope

- Merging both streams into one interleaved view.
- Any log storage of our own: journald and pm2 already rotate, and their retention is the operator's to configure.
