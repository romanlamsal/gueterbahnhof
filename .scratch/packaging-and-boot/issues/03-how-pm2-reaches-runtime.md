# 03 — How pm2 reaches runtime

Type: grilling
Status: open
Blocked by: 01, 02

## Question

How does pm2 get to the running server, given it is CJS with dynamic requires, ships its own fork container spawned **by path** (`lib/ProcessContainerFork.js`), and cannot be inlined into the ESM bundle (`ERR_AMBIGUOUS_MODULE_SYNTAX`)?

Options to weigh:

- **Declared dependency** of the published package — npm installs pm2 normally; the bundle's bare `import "pm2"` resolves from the installed package's own `node_modules`; the traced copy is deleted from the tarball (~877 fewer files).
- **Keep shipping the traced copy**, made symlink-free (e.g. dereferencing the copy so npm packs real directories) so nothing depends on npm preserving symlinks.
- **Peer or optional dependency**, making the operator's pm2 the one that runs.

Decide the consequences explicitly: what `dist/package.json` declares, whether `.output/server/node_modules` ships at all, whether the version pm2 runs at is pinned by us or resolved by npm, and what happens on a machine where pm2's install fails.

Depends on 02 for *which* package declares it.
