# Map: packaging & eager boot

Label: wayfinder:map

## Destination

`@lamsal-de/gueterbahnhof` **1.0.1 installs from npm and boots eagerly** — pm2 resolvable, apps started and legacy config migrated at startup without any HTTP request. Proven by a real install (clean local install rehearsal, then the production box), with the packaging and boot decisions recorded as ADRs on the way.

## Notes

**Domain:** see `CONTEXT.md` for vocabulary (App, Artifact, Deployment, App Directory, Process Manager…). Binding decisions: `docs/adr/0001-async-deploy-contract.md`, `docs/adr/0002-no-daemon-pm2-lifecycle.md`.

**Skills:** decision tickets use `/grilling` + `/domain-modeling`; research tickets use `/research`.

**This map executes.** The destination is a shipped release, so tickets 05 and 06 deliberately *do* rather than decide — overriding wayfinder's plan-don't-do default. Everything before them stays decision work.

**Standing constraints:** never run real pm2 in the test suite (manual smoke runs are fine). No `gh` CLI in this repo (work account). Never put real credentials in fixtures — the production `apps.json` holds live secrets.

**Verified facts to carry** (established 2026-08-05, don't re-derive):

- `npm pack` **does** include nested `node_modules` (877 files under `server-output/server/node_modules`, incl. 182 in the `.nf3` store) but **silently drops symlinks** — 5 of them (`async`, `eventemitter2`, `pidusage`, `semver`, `debug`) point into `.nf3/<pkg>@<version>`, so `node_modules/async` ships as *nothing* and pm2 dies with `Cannot find module 'async/eachLimit'`.
- `pm2` is the **only** bare (non-`node:`) import in the entire built server output.
- Boot code (from `src/server.ts`) lands in `.output/server/_ssr/index.mjs`, reached only via a dynamic `import("../_ssr/index.mjs")` in `_chunks/ssr-renderer.mjs` — hence lazy.
- Boot failures currently surface as an opaque `{"error":true,"status":500,"unhandled":true}` on whichever request happened to trigger boot.
- pm2 rewrites a `script` containing a space into `bash -c "<command>"` (`lib/Common.js:726`), so shell-command entries like `pnpm install && pnpm start` work — not a bug, don't "fix" it.
- `traceDeps: ["pm2*"]` was needed because inlining pm2 produced `ERR_AMBIGUOUS_MODULE_SYNTAX`; the `*` matters because pm2 spawns `lib/ProcessContainerFork.js` by path.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Release flow after the packaging shape changes** — whether the workflow still builds via turbo and publishes with changesets, and whether a second package needs its own publish step. Hangs on 02.
- **Where `.output` is built** — CI each release vs prebuilt artifact. Hangs on 02.
- **Static asset serving** after the boot decision (currently `express.static` over `server-output/public`). Hangs on 04.
- **Nitro's eager-startup mechanisms** (plugins, hooks, presets) and **output chunk-path stability** — researched only if 08 leaves anything that must be eager *inside* the server module. Ticket 01 was narrowed to the packaging question on 2026-08-05 for exactly this reason; re-open this if 08 keeps lifecycle work in the server.
- **Whether the CLI and the built server can share one pm2 module instance** — only matters if 08 keeps no-daemon mode. Was ticket 07's third sub-question; deliberately unresearched until 08 is decided.

## Out of scope

- **CI regression guard** (pack + clean-install + assert-eager-boot in the pipeline) — ruled out for this effort; the verification lives in tickets 05/06 as manual proof instead.
- **Corrupt legacy config semantics** — boot currently logs and starts zero apps when `apps.json` is unparseable (as seen truncated in production on 0.2.x); hard-failing instead is not part of this effort.
- **Express wrapper's fate** as an independent decision — if 04 entails removing it, that rides along; it gets no ticket of its own.
- **Deprecating the broken 1.0.0 on npm** — operator action, outside the map.
*(Revisiting ADR-0002's no-daemon lifecycle was ruled out here on 2026-08-05 and then ruled back **in** the same day — it turned out to be the root of the shared-instance and eager-boot problems rather than a separate concern. It is now ticket 08 and leads the map.)*
