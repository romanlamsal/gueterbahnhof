# 01 — Prefactor: layer the codebase

**What to build:** No behavior change. The existing tanstack server code is reorganized into the four agreed layers — controllers (routes/server functions), app services, domain services, interface services — so every later ticket lands in an obvious place with an obvious test strategy. The config schema and UI say `entry` instead of `script` (pm2's word survives only inside the process-manager adapter), and `createService` becomes `createApp` per the glossary. The vitest harness is proven: the config repository (an interface service) gets real tests against a real filesystem in a per-test tmpdir, including the dotenv sidecar merge.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Code is organized into controller / app-service / domain-service / interface-service layers; imports only point downward
- [ ] Config schema field is `entry`; the pm2 adapter maps it to pm2's `script`; UI form label reads Entry
- [ ] No identifier or user-facing string says "service" where the glossary says App
- [ ] `pnpm test` runs config-repository tests against real fs in tmpdirs (create, read with sidecar merge, update, list) and passes
- [ ] Typecheck and build still pass; existing UI behavior unchanged
