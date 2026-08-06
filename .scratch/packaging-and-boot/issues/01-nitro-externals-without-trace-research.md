# 01 — Nitro 3 beta: can a dependency be externalized without being traced?

Type: research
Status: resolved
Blocked by: none — can start immediately

## Question

Narrowed on 2026-08-05: this ticket originally also covered nitro's eager-startup mechanisms (plugins, hooks, presets) and output chunk-path stability. Ticket 08 (pm2 daemon mode) may remove the need for *any* eager evaluation inside the server module, so those questions are deferred to the map's fog rather than researched now. What remains matters for packaging either way.

For the exact installed nitro (`nitro@3.0.260610-beta`, driven by TanStack Start's vite plugin, preset `node-middleware`):

Can a dependency be **externalized** — left in the output as a bare `import "pm2"` — **without** nitro tracing and copying its tree into `.output/server/node_modules`?

Today `traceDeps: ["pm2*"]` in `packages/server-tanstack/vite.config.ts` does both at once: it externalizes pm2 (needed, since inlining it produces `ERR_AMBIGUOUS_MODULE_SYNTAX`) *and* copies 79 real directories plus 5 symlinks into the output. Those symlinks are what npm drops on publish, which is what broke 1.0.0.

Investigate in the installed source, not the docs (this is a beta and the docs lag):

- The externals plugin call site and its options (`include`, `exclude`, `trace`) in `dist/_build/common.mjs` — search `traceDeps`, `noExternals`, `externals(`.
- Config surface in `dist/types/index.d.mts`: `traceDeps`, `traceOpts`, `noExternals`, `commonJS`, `exportConditions`.
- Whether `trace` can be disabled for a production build, or whether it is hardcoded on outside dev/prerender.

If it is not configurable, say so plainly and answer the fallback instead: is discarding `.output/server/node_modules` after the build safe, given `pm2` is the only bare import in the entire output?

Ground truth: `realpath node_modules/nitro`. Record findings under `.scratch/packaging-and-boot/research/` and link them from this ticket's Answer.

## Answer

Resolved from direct inspection rather than a research pass — the two facts that mattered took minutes, and ticket 08 had already removed the rest of the ticket's reason to exist.

1. **No, externalize-without-trace is not configurable.** In `nitro/dist/_build/common.mjs:28480-28489` the externals plugin is constructed with `trace: isDevOrPrerender ? false : { ...nitro.options.traceOpts, outDir: nitro.options.output.serverDir }`. Tracing is therefore hardcoded on for every production build; `traceOpts` only forwards `nft`/`traceAlias`/`chmod`/`transform`/`hooks` (`dist/types/index.d.mts:1981`) and cannot switch the copy off. `noExternals` does the opposite of what we want (it inlines, which is what produced `ERR_AMBIGUOUS_MODULE_SYNTAX`).

2. **Deleting `.output/server/node_modules` after the build is safe.** `pm2` is the only bare, non-`node:` import in the entire output; no output code reads `node_modules` or the generated `server/package.json` at runtime (grep across all `*.mjs`); and every output file outside that directory is `.mjs`, so the generated `{"type":"module"}` manifest is not load-bearing either — though there is no reason to remove it. With pm2 declared as a real dependency, the bundle's bare `import "pm2"` resolves by walking up to the installed package's own `node_modules`.

3. **Making the traced copy symlink-free was not pursued.** It only matters if we keep shipping pm2 inside the tarball, and after 08 that is the wrong shape anyway (see below).

4. **Upgrade risk:** the deletion approach depends only on nitro emitting bare specifiers for externals — far more stable than the internal chunk layout or the trace format. A future nitro that stops tracing would simply make the deletion a no-op.

## Recommendation for ticket 03

The option space has collapsed to one plausible answer. Ticket 08 put the fleet's lifecycle in the CLI, so **the CLI process now needs a pm2 client of its own**, and 08's version-alignment constraint says the client that spawns the daemon and the client the server drives must be the same pm2. One installed copy that both resolve satisfies that; a shipped traced copy plus an installed copy is exactly the mismatch pm2 refuses. So: **pm2 as a declared dependency of the published package**, `.output/server/node_modules` discarded in `bundle.js`, and the "zero runtime dependencies" property abandoned — it was self-imposed, and it is what broke 1.0.0.
