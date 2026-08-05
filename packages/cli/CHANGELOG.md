# @lamsal-de/gueterbahnhof

## 1.0.0

### Major Changes

-   Rewrite the server as a TanStack Start app and ship it inside the CLI.

    -   Deploys are asynchronous (ADR-0001): `POST /update/:appname` responds `202 { deploymentId }`, progress at `GET /update/:appname/status` (optionally `?deploymentId=`). At most one deployment in flight per app (409).
    -   `gueterbahnhof deploy` gains `--wait` (env `GUETERBAHNHOF_WAIT`); the GitHub Action gains a `wait` input defaulting to `true` so CI fails on failed deploys.
    -   Auth enforced properly: API key on every management route; the UI logs in with the key and gets a signed, verified session cookie.
    -   New UI (React/shadcn): live app states over SSE, dotenv editing, unique app names, delete with full cleanup, distinct "no artifact" state.
    -   Legacy installs migrate automatically on first boot (`apps.json` → per-app configs, artifact dirs moved); the legacy file is renamed to `apps.json.migrated`.
    -   Config field `script` is now `entry`; apps have a stable `id` alongside their unique `name`.
    -   App logs are timestamped (`YYYY-MM-DD HH:mm:ss`) via pm2's `log_date_format`.
    -   The UI's dotenv editor round-trips npm dotenv's quoting/comment/multiline rules and can read and write URI-safe serialized values ("Escaped" mode).
    -   Breaking: raw pm2 describe output (`GET /status/:name`) is gone — use `GET /apps`; the server package is no longer published separately.

## 0.2.2

### Patch Changes

-   fix(server): set cwd to app's directory first before starting and reloading

## 0.2.1

### Patch Changes

-   a902d0a: Read env variables in client cli as substitutes for flags

## 0.2.0

### Minor Changes

-   14d766a: Switch to changesets. Yay!
