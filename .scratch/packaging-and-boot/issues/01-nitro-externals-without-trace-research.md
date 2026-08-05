# 01 — Nitro 3 beta: can a dependency be externalized without being traced?

Type: research
Status: open
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
