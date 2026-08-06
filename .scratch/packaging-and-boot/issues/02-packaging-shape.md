# 02 — Packaging shape: one package or two?

Type: grilling
Status: resolved
Blocked by: 01

## Question

Does the built server keep shipping **inside** the single `@lamsal-de/gueterbahnhof` package (today: `bundle.js` esbuilds `cli.ts` and copies `packages/server-tanstack/.output` into `dist/server-output`), or does the server become **its own published package** that the CLI depends on?

Weigh:

- The single-bin promise — `pnpx @lamsal-de/gueterbahnhof deploy` in the GitHub Action, one global install on the server, one version number.
- How `.output` travels through npm either way. Note the trap is not avoided by splitting: a server package would publish the same traced `node_modules` and lose the same symlinks unless its externals are declared dependencies (see 03).
- Versioning and release mechanics for two packages (changesets, the workflow's build order).
- Reversibility: which choice is cheaper to undo in six months?

Decide also whether `dist/package.json` keeps its "zero runtime dependencies" property or whether that goal was itself the mistake that produced the 1.0.0 break.

## Answer

**Keep the single package.** The server keeps shipping inside `@lamsal-de/gueterbahnhof`.

- **Splitting fixes nothing.** A separate server package would publish the same traced tree and lose the same symlinks on `npm pack` unless pm2 is a declared dependency — and declaring pm2 is the actual fix in either shape (see 01, 03).
- **It preserves the single-bin promise:** `pnpx @lamsal-de/gueterbahnhof deploy` in the GitHub Action, one global install on the host, one version number to reason about.
- **It avoids doubling the release mechanics** — two changesets, cross-package version alignment, a second publish step — for a solo-maintained project.
- **The real mistake was the self-imposed "zero runtime dependencies" goal**, not shipping the server inside the CLI. That property is abandoned deliberately: `dist/package.json` regains a `dependencies` block.

Consequences: `bundle.js` keeps copying `.output` into `dist/server-output` but discards `server-output/server/node_modules`; `packages/cli/package.json` is the package that declares pm2 (answering 03's "which package"); the published tarball drops from ~1025 files to roughly 150.

Reversibility is cheap — the layout never leaks into the wire contract, so splitting later is moving files plus a publish step.
