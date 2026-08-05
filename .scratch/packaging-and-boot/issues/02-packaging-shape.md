# 02 — Packaging shape: one package or two?

Type: grilling
Status: open
Blocked by: 01

## Question

Does the built server keep shipping **inside** the single `@lamsal-de/gueterbahnhof` package (today: `bundle.js` esbuilds `cli.ts` and copies `packages/server-tanstack/.output` into `dist/server-output`), or does the server become **its own published package** that the CLI depends on?

Weigh:

- The single-bin promise — `pnpx @lamsal-de/gueterbahnhof deploy` in the GitHub Action, one global install on the server, one version number.
- How `.output` travels through npm either way. Note the trap is not avoided by splitting: a server package would publish the same traced `node_modules` and lose the same symlinks unless its externals are declared dependencies (see 03).
- Versioning and release mechanics for two packages (changesets, the workflow's build order).
- Reversibility: which choice is cheaper to undo in six months?

Decide also whether `dist/package.json` keeps its "zero runtime dependencies" property or whether that goal was itself the mistake that produced the 1.0.0 break.
