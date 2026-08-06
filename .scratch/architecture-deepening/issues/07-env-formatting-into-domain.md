# 07 — Move Env formatting into the domain

Type: task
Status: resolved
Blocked by: none — can start immediately

## Question

`lib/dotenv-roundtrip.ts` holds Env quoting and escaping rules — domain knowledge — in a folder inherited from the TanStack template, alongside shadcn's `cn()` in `lib/utils.ts`. The four-layer scheme therefore stops telling you where things live.

Move it to `domain/`, leaving `lib/` to the template helper. A pure move: imports update, its tests move with it, nothing else changes.

Marked speculative in the review — if the move makes the UI's import path worse rather than better, say so and rule it out of scope rather than forcing it.

## Answer

**Moved** — the import path improved rather than worsened, so the speculative flag came off.

`lib/dotenv-roundtrip.ts` is now `domain/env-format.ts`, with its tests alongside. The only consumer, the App Config form, reads `@/domain/env-format.ts`, which says what the module is rather than where it happened to land. `lib/` now holds exactly one thing — shadcn's `cn()` — so the four-layer scheme accounts for everything again.

A pure move: no logic changed, and the same tests pass against the new path.
