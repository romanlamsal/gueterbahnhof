# server-tanstack

The gueterbahnhof server: a TanStack Start app that hosts the management API
(deploy artifacts by app name, per ADR-0001) and the UI, driving apps through
pm2 in no-daemon mode (ADR-0002).

## Development

```bash
GUETERBAHNHOF_DIR=/path/to/appdir pnpm dev        # dev server on :3000
GUETERBAHNHOF_API_KEY=secret ... pnpm dev          # with auth enabled
pnpm test                                          # vitest
pnpm build                                         # nitro output in .output/
```

The built output ships inside the published CLI (`@lamsal-de/gueterbahnhof`,
see `packages/cli`) — `gueterbahnhof server` hosts `.output` via express.

## Layout

- `src/domain/` — pure rules (deployment lifecycle, restart decisions, app state)
- `src/app-services/` — orchestration, tested against fakes
- `src/interface-services/` — fs/pm2/crypto adapters, tested against the real thing (never real pm2)
- `src/controllers/` + `src/routes/` — HTTP surface
- `src/runtime/` — env parsing and the composition root
