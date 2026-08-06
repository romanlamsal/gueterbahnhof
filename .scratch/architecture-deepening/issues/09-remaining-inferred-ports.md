# 09 — The other two ports are inferred too

Type: task
Status: resolved
Blocked by: 01

## Question

Surfaced while resolving 01: the Process Manager was not the only port inferred from its implementation.

- `interface-services/app-config-repository.ts:113` — `export type AppConfigRepository = ReturnType<typeof createAppConfigRepository>`
- `interface-services/artifact-store.ts:43` — `export type ArtifactStore = ReturnType<typeof createArtifactStore>`

The consequence is the same: implementation details are part of the contract, so a fake cannot satisfy it. `app-service.test.ts:62` still casts its repository fake `as unknown as AppConfigRepository` — the last cast in that file — because the inferred type includes `getConfigPath`, which no caller uses and no fake should have to invent.

Do for both what 01 did for the Process Manager: write the interface by hand from what callers actually use, have the factory declare it, and delete the cast. Note that `getConfigPath` may turn out to be genuinely unused outside the module — check before including it.

Smaller than 01: the shapes are already domain-shaped (`AppConfig`, paths, booleans); this is about who declares them.

## Answer

Both ports are now hand-written, and **the test suite contains zero casts** — down from four when this map started.

- `AppConfigRepository` declares the six methods callers use. `getConfigPath` was indeed unused outside its module, so it became a closure helper (`configPath`, plus `envSidecarPath` for the dotenv sidecar) rather than part of the contract. `updateAppConfig` now returns `… | undefined` instead of `… | void`, which is what a caller checking the result actually means.
- `ArtifactStore` declares its four methods, with the App Directory resolved by a closure helper rather than a public method calling `this`.
- Both factories annotate their return type, so the compiler checks the implementation against the port instead of inferring the port from the implementation.
- The App service's fake repository satisfies `AppConfigRepository` structurally, so the last `as unknown as` is gone.

**Deliberately left inferred:** the App services and controllers still export `ReturnType<typeof create…>`. That has not forced a single cast, because their callers take `Pick<…>` of the few methods they need and fakes satisfy those structurally. The rule this map settles on: **interface-service ports are written by hand — they are the substitution seams that fakes stand in for — while services and controllers can stay inferred until it hurts.**

139 tests, typecheck, biome and the packaged build all green.
