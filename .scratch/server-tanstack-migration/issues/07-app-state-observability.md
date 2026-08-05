# 07 — App state observability

**What to build:** Everyone can see what's actually running. An app whose config exists but whose directory holds no artifact shows a distinct `no artifact` state (the legacy `no-entry` signal reborn) instead of masquerading as stopped. A monitoring script gets `GET /apps` returning `{id, name, state}` for every app, protected like the other API routes. The UI subscribes to a server-sent-events stream fed by the process manager's event bus, so state flips (online, stopped, pending) appear live without refreshing — the existing event-bus service finally gets its consumer.

**Blocked by:** 02 — Deploy tracer bullet (app-directory knowledge for the `no artifact` derivation).

**Status:** resolved

- [x] State derivation (process status + artifact presence → online/stopped/pending/no artifact) is a pure domain function with unit tests
- [x] `GET /apps` returns `{id, name, state}[]`, API-key protected when a key is set
- [x] SSE endpoint streams state-change events; controller test asserts the stream framing with a fake event source
- [x] UI list reflects a state change without a manual refresh and shows `no artifact` distinctly
- [x] Deploying an artifact to a `no artifact` app flips its state live once started
