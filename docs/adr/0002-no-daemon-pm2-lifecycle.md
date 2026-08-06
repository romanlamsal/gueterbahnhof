---
status: superseded by ADR-0003
---

# No-daemon pm2 lifecycle

Gueterbahnhof connects to pm2 in no-daemon mode (`pm2.connect(true)`): the process manager lives inside the gueterbahnhof process, so gueterbahnhof and every app it manages die together. On SIGTERM/SIGINT the server wipes (deletes) its pm2 processes so no stale state lingers. We deliberately rejected daemon mode — which would let apps survive a gueterbahnhof restart — in favor of a single process tree with nothing stray running outside it.

## Consequences

- Restarting or updating gueterbahnhof means downtime for **all** managed apps. This is accepted; don't "fix" it by switching to daemon mode without revisiting this ADR.
- Boot must therefore always start every configured app from scratch; there is no reconciliation with pre-existing pm2 state.

## Why this was superseded (2026-08-05)

Revisited exactly as this ADR invited. Two things forced it: the in-process daemon meant fleet state lived in a *module instance*, so the CLI and the built server could not both drive pm2 — which is what kept boot trapped inside a lazily-evaluated nitro chunk; and a crashing gueterbahnhof took every managed app down with it, which happened in production. ADR-0003 replaces this with an external daemon while keeping the part that was actually wanted: a graceful shutdown still takes our own fleet down, and only ours.
