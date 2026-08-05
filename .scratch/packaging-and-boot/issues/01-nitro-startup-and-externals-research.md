# 01 — Nitro 3 beta: eager startup hooks and externals-without-trace

Type: research
Status: claimed
Blocked by: none — can start immediately

## Question

For the exact nitro in this repo (`nitro@3.0.260610-beta`, driven by TanStack Start's vite plugin, preset `node-middleware`), establish with version-specific evidence:

1. **Eager startup.** What mechanisms exist to run code when the server starts rather than on first request — nitro plugins, `plugins` config, lifecycle hooks (`hooks`), server-entry conventions? For each: does it execute when the built entry module (`.output/server/index.mjs`) is *imported*, or only when a request is handled? Does a nitro plugin run under `node-middleware`, where the host (our express wrapper) owns the listener?
2. **Presets.** Would `node-server` (or another preset) own startup itself and boot eagerly, and what would that cost us — do we lose the express wrapper, static file serving, `handleUpgrade`?
3. **Externals without tracing.** Can a dependency be externalized (left as a bare `import "pm2"`) *without* nitro tracing and copying it into `.output/server/node_modules`? Look at `externals`/`traceDeps`/`traceOpts`/`noExternals` handling in the installed nitro build code, not just docs — the plugin call site is in `nitro/dist/_build/common.mjs` (search `traceDeps` / `noExternals`).
4. **Chunk-name stability.** Is `_ssr/index.mjs` a stable output path across builds/versions, or should code never hardcode it?

Prefer the installed source in `node_modules/.pnpm/nitro@3.0.260610-beta*/node_modules/nitro` as ground truth (it's a beta; docs lag). Note where docs and source disagree.

Record findings as a markdown file under `.scratch/packaging-and-boot/research/` and link it from this ticket's Answer.
