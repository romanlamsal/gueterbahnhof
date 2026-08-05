# 04 — Eager boot mechanism

Type: grilling
Status: open
Blocked by: 01, 07

## Question

How does the boot work that **must** live in the server module (per 07's split — pm2 connect, `appStateService.init()`, `startAllApps`, the SIGTERM wipe) become **eager and loud**? Boot today is module side effects with top-level await in `packages/server-tanstack/src/server.ts`, bundled into `.output/server/_ssr/index.mjs`, which only runs when something triggers an SSR render.

Note the stakes if this is left lazy: managed apps stay stopped until someone requests a page — unacceptable for a host whose apps must run continuously.

Candidate mechanisms (01 supplies the facts):

- A **nitro plugin** that runs at app init (the user's instinct).
- **Eager import** of the built SSR chunk from the CLI before `listen` — needs a stable chunk path plus a build-time assertion.
- A **preset change** (e.g. `node-server`) so nitro owns startup.
- Moving boot **into the CLI process** itself — rejected if it means a second module instance of the services (two pm2 connections, two in-memory deployment stores).

Must also decide the startup contract:

- Does the server accept connections only **after** boot succeeds?
- How does a boot failure surface — non-zero exit at startup with the real stack, instead of today's opaque 500 on a random request?
- Where do the signal handlers get installed so the ADR-0002 wipe still runs?
