# 03 — How pm2 reaches runtime

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

How does pm2 get to the running server, given it is CJS with dynamic requires, ships its own fork container spawned **by path** (`lib/ProcessContainerFork.js`), and cannot be inlined into the ESM bundle (`ERR_AMBIGUOUS_MODULE_SYNTAX`)?

Options to weigh:

- **Declared dependency** of the published package — npm installs pm2 normally; the bundle's bare `import "pm2"` resolves from the installed package's own `node_modules`; the traced copy is deleted from the tarball (~877 fewer files).
- **Keep shipping the traced copy**, made symlink-free (e.g. dereferencing the copy so npm packs real directories) so nothing depends on npm preserving symlinks.
- **Peer or optional dependency**, making the operator's pm2 the one that runs.

Decide the consequences explicitly: what `dist/package.json` declares, whether `.output/server/node_modules` ships at all, whether the version pm2 runs at is pinned by us or resolved by npm, and what happens on a machine where pm2's install fails.

Depends on 02 for *which* package declares it.

## Narrowed by 01 and 08

The option space has effectively collapsed to the **declared dependency**. 08 moved the fleet's lifecycle into the CLI, so the CLI needs its own pm2 client, and 08's version-alignment constraint means both clients should resolve one installed copy — a shipped copy alongside an installed one is precisely the mismatch pm2 refuses. 01 confirmed the traced copy cannot be turned off but can be safely discarded after the build. What is left to confirm here is the *consequences*, not the choice: which package declares pm2 (waits on 02), what version range, and what the failure looks like on a machine where pm2's own install fails.

## Added constraint (from 08)

Since 08 chose an external daemon, the pm2 copy that **spawns** the daemon and the copy the **server** drives must be the same version — pm2 refuses a client whose version mismatches the running daemon. Any option that could end up with two different pm2 copies in play (e.g. a bundled copy alongside an operator-installed one) has to explain how versions stay aligned.

## Answer

**pm2 is a declared dependency of the published package**, at a caret range mirroring what `server-tanstack` builds against (`"pm2": "^6.0.14"`), written into `dist/package.json` by `bundle.js`.

- **Who declares it:** `packages/cli/package.json` — the single published package (02).
- **What ships:** `bundle.js` discards `dist/server-output/server/node_modules` after copying `.output`, since tracing cannot be disabled but the copy is safely removable (01). The bundle's bare `import "pm2"` then resolves by walking up to the installed package's own `node_modules`.
- **Version alignment (08's constraint) holds:** exactly one installed copy exists, so the client that spawns the daemon and the client the server drives are the same pm2 by construction.
- **Caret, not a pin:** patch and minor fixes reach hosts without a gueterbahnhof release; the alignment argument doesn't require a pin because both clients resolve the same installed copy either way.
- **Hard dependency, not optional:** nothing works without pm2, so a failed install should fail loudly at install time rather than becoming a runtime surprise.
- **"Zero runtime dependencies" is abandoned** deliberately (02) — it was self-imposed and it is what broke 1.0.0.
