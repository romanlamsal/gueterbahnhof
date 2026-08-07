# 01 — Introduce the Stationmaster and reduce the server command to argv parsing

**What to build:** `gueterbahnhof server` behaves exactly as it does today, but the CLI stops being where the server lives. Everything between "the arguments are known" and "the process is serving" — applying the environment the built server reads, booting the Fleet, installing shutdown handlers, assembling HTTP, and listening — moves into a single entry exported from the server package: the Stationmaster. The CLI's `server` command is left with flag definitions, required-flag validation, the version log, resolving where its own bundled server output sits, and one call.

An operator sees no difference: same flags, same environment variables, same startup message, same exit codes, same shutdown behaviour.

Two things ride along because they cannot be separated. The HTTP framework dependency moves to the server package, since that is now what imports it. And the Stationmaster takes its Fleet-lifecycle and middleware-loading collaborators as defaulted parameters — real behaviour by default, substitutable in a test — which is what makes the startup path testable for the first time.

Design and reasoning: [spec](../spec.md). The decision is already recorded in ADR-0006 and `CONTEXT.md`; this ticket implements it and must not contradict it.

**Blocked by:** None — can start immediately.

**Status:** implemented

## Structure

- [x] The server package exports one function that takes the App Directory, the port, the API Key, and the location of the built server output, and returns once the process is listening
- [x] The built-server-output location is passed in by the CLI, not discovered — it is the only packaging-shaped parameter, and the CLI's existence check for it stays on the CLI side
- [x] The Stationmaster lives in a directory whose name marks it as running outside the nitro bundle, with a comment at the top of the module saying why a route must never import it
- [x] The CLI's `server` command contains no HTTP assembly, no Fleet boot, no signal handling and no listening
- [x] Required-flag validation stays manual, consistent with how this repo uses its CLI library
- [x] The HTTP framework is declared by the server package rather than the CLI

## Behaviour preserved

- [x] A missing App Directory reports the same message and sets the same exit code
- [x] A missing server bundle still fails loudly as a packaging error
- [x] A Fleet boot failure still exits non-zero, and nothing listens
- [x] `SIGTERM` and `SIGINT` still stop the Fleet and leave the process manager's daemon alone, and a second signal is still ignored
- [x] Static assets are still registered before the nitro middleware — the next commit changes this deliberately, this one must not
- [x] The startup message still names the same port
- [x] Journald priority prefixes still apply under systemd

## Tests through the new seam

- [x] The Fleet is booted before the server listens
- [x] A boot rejection propagates and nothing listens
- [x] A termination signal stops the Fleet once; a second signal does not stop it again
- [x] The static handler is registered before the nitro middleware
- [x] The configured port is the one listened on
- [x] An API Key reaches the environment the built server reads, and an absent one leaves it unset
- [x] No test runs a process manager, and no test loads a production build

## Ships

- [x] A full build succeeds and the published manifest still declares only the process manager as a dependency
- [x] The CLI bundle inlines the HTTP framework; the nitro output does not contain it
- [x] The built binary boots, serves the UI, and round-trips a deploy
