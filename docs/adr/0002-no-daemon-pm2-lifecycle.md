# No-daemon pm2 lifecycle

Gueterbahnhof connects to pm2 in no-daemon mode (`pm2.connect(true)`): the process manager lives inside the gueterbahnhof process, so gueterbahnhof and every app it manages die together. On SIGTERM/SIGINT the server wipes (deletes) its pm2 processes so no stale state lingers. We deliberately rejected daemon mode — which would let apps survive a gueterbahnhof restart — in favor of a single process tree with nothing stray running outside it.

## Consequences

- Restarting or updating gueterbahnhof means downtime for **all** managed apps. This is accepted; don't "fix" it by switching to daemon mode without revisiting this ADR.
- Boot must therefore always start every configured app from scratch; there is no reconciliation with pre-existing pm2 state.
