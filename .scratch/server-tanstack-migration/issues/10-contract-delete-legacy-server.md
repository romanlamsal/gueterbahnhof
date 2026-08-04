# 10 — Contract: delete the legacy server

**What to build:** The repo contains exactly one server and no fossils. With the published CLI switched over (09), the legacy express server package is deleted, along with the dead reverse-proxy types in the common package (decided 2026-08-04: not coming back) and the TanStack template leftovers — the template landing page gives way to the app list (or a redirect to it), and template README/demo files/scratch servers disappear. The common package keeps only what is still consumed.

**Blocked by:** 09 — Ship it in the published CLI.

**Status:** ready-for-agent

- [ ] Legacy express server package removed; workspace install, typecheck, build, and tests all green
- [ ] Dead `Service`/`App` reverse-proxy types removed from the common package
- [ ] Root route shows or redirects to the app list; template landing page, demo files, template README and scratch servers gone
- [ ] No remaining references to the removed package anywhere (workspace deps, turbo config, docs)
- [ ] `current-state.md` gap list re-checked: every item either done or explicitly out of scope
