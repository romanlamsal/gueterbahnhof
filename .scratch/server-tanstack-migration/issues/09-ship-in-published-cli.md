# 09 — Ship it in the published CLI

**What to build:** Upgrading is a drop-in. `gueterbahnhof server` from the published single bin (`@lamsal-de/gueterbahnhof`) now hosts the built tanstack server instead of the legacy express one, with the same operator surface: `--app-dir` (required), `--port` (default 4444), `--api-key`, each with its `GUETERBAHNHOF_*` env fallback. The publish pipeline bundles the built server output and its static assets into the package. An existing install upgrades the package, restarts the service, and everything — including its just-auto-migrated apps — keeps working; `gueterbahnhof deploy` is unchanged alongside.

**Blocked by:** 02 — Deploy tracer bullet; 04 — Auth done right; 08 — Boot, shutdown & legacy auto-migration.

**Status:** resolved

- [x] `gueterbahnhof server --app-dir <dir>` starts the tanstack server on port 4444 by default; flags and env fallbacks match legacy names
- [x] The published package is self-contained: built server + static assets included, no dev-time tooling required at runtime
- [x] Deploy + status + UI all reachable through the packaged server (smoke-verifiable locally via the built package)
- [x] `deploy` subcommand still works from the same bin
- [x] Version output still reported from the package metadata
