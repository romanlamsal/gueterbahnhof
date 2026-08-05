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

- [pm2 daemon mode: revisit ADR-0002](issues/08-pm2-daemon-mode.md) — **external daemon**, auto-spawned and never killed; our apps isolated in a `gueterbahnhof` pm2 namespace; shared `~/.pm2` by default but an explicit `PM2_HOME` is honoured and inherited by the daemon; graceful shutdown stops only our fleet; boot always stop→delete→starts every configured app; nothing needs to be eager inside the server module. Supersedes ADR-0002 (new ADR to be written).
- [Boot decomposition: CLI process vs server module](issues/07-boot-decomposition.md) — subsumed by 08: the CLI owns the whole lifecycle, and sharing a pm2 module instance is moot under a daemon.
- [Eager boot mechanism](issues/04-eager-boot-mechanism.md) — subsumed by 08: no boot work remains in the server module, so the CLI fails loudly before it listens; no nitro plugin, chunk path or preset change needed.
- [Nitro: externalize without tracing?](issues/01-nitro-externals-without-trace-research.md) — no, tracing is hardcoded on for production builds; but discarding `.output/server/node_modules` after the build is safe (pm2 is the only bare import, nothing reads that dir at runtime), which is the route to take.
- [Packaging shape: one package or two?](issues/02-packaging-shape.md) — **one package**: the server keeps shipping inside `@lamsal-de/gueterbahnhof`. Splitting fixes nothing, the single-bin promise is worth keeping, and the "zero runtime dependencies" goal is abandoned deliberately — `packages/cli/package.json` declares pm2.
- [How pm2 reaches runtime](issues/03-how-pm2-reaches-runtime.md) — **declared dependency** `"pm2": "^6.0.14"` in `packages/cli/package.json`, hard rather than optional; `bundle.js` discards the traced `server-output/server/node_modules`. One installed copy keeps the daemon-spawning client and the server's client aligned per 08.
- [Fleet ownership mechanism](issues/09-fleet-ownership-mechanism.md) — **flat names, discoverability over isolation**: pm2 stays addressed by plain app name so `pm2 restart <app>` keeps working; `namespace: "gueterbahnhof"` is kept as a label and manual bulk lever but explicitly not a boundary; a same-named foreign process is an accepted, documented risk. Supersedes decision 4 of [08](issues/08-pm2-daemon-mode.md).

## Not yet specified

- **Release flow after the packaging shape changes** — whether the workflow still builds via turbo and publishes with changesets, and whether a second package needs its own publish step. Hangs on 02.
- **Where `.output` is built** — CI each release vs prebuilt artifact. Hangs on 02.
- **Static asset serving** after the boot decision (currently `express.static` over `server-output/public`). Hangs on 04.
- **Reboot survival** — with the daemon holding the fleet, what starts things after a machine reboot: gueterbahnhof under systemd (our configs stay the single source of truth) or pm2's own `startup`/`resurrect` (a second source of truth). Surfaced by 08; sharpen once 05 is under way.

## Out of scope

- **CI regression guard** (pack + clean-install + assert-eager-boot in the pipeline) — ruled out for this effort; the verification lives in tickets 05/06 as manual proof instead.
- **Corrupt legacy config semantics** — boot currently logs and starts zero apps when `apps.json` is unparseable (as seen truncated in production on 0.2.x); hard-failing instead is not part of this effort.
- **Express wrapper's fate** as an independent decision — if 04 entails removing it, that rides along; it gets no ticket of its own.
- **Deprecating the broken 1.0.0 on npm** — operator action, outside the map.
*(Revisiting ADR-0002's no-daemon lifecycle was ruled out here on 2026-08-05 and then ruled back **in** the same day — it turned out to be the root of the shared-instance and eager-boot problems rather than a separate concern. It is now ticket 08 and leads the map.)*
