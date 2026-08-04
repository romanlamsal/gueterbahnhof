# 08 — Boot, shutdown & legacy auto-migration

**What to build:** An administrator points the new server at an existing legacy app directory and it just works, headlessly. On boot: if a legacy single-file config (`apps.json`) is present, it is migrated automatically — ids minted, one config file written per app with `entry` copied verbatim, the legacy file renamed to `apps.json.migrated`, outcome logged. A missing app directory is created, or the server exits non-zero with a clear message — never an interactive prompt. Boot then starts every configured app and logs "started X of Y". On SIGTERM/SIGINT the server wipes its managed processes exactly once and exits (ADR-0002).

**Blocked by:** 01 — Prefactor: layer the codebase.

**Status:** ready-for-agent

- [ ] Legacy `apps.json` migrated on first boot: per-app files with minted ids, `entry` preserved, env preserved, original renamed to `.migrated`; second boot is a no-op
- [ ] Migration logic tested against real fs in tmpdirs, including idempotency
- [ ] No interactive prompts anywhere in the boot path; missing dir → created or fail-fast non-zero
- [ ] Boot starts all configured apps and logs the started/total count
- [ ] Duplicate SIGTERM/SIGINT wipes processes once, then exits
