# gueterbahnhof

A small, self-hosted deployment server. You POST a zipped build artifact at it, and it runs the app under pm2 with the environment you configured. No containers, no registry, no Dockerfile — if your CI can produce a directory, it can deploy.

One published package, `@lamsal-de/gueterbahnhof`, contains both halves: the server you run on your box and the client your CI runs.

## Quick start

### 1. Set up the server

Needs Node 22 or newer. pm2 comes along as a dependency.

```bash
npm install -g @lamsal-de/gueterbahnhof
```

Put the server's settings in `~/.gueterbahnhof` and keep it to yourself — it holds your API key:

```bash
cat > ~/.gueterbahnhof <<'EOF'
GUETERBAHNHOF_APP_DIR=/home/you/gueterbahnhof
GUETERBAHNHOF_PORT=4444
GUETERBAHNHOF_API_KEY=pick-something-long
EOF
chmod 600 ~/.gueterbahnhof
```

Generate a systemd user unit and enable it:

```bash
mkdir -p ~/.config/systemd/user
gueterbahnhof systemd > ~/.config/systemd/user/gueterbahnhof.service
systemctl --user daemon-reload
systemctl --user enable --now gueterbahnhof

loginctl enable-linger "$USER"   # without this, nothing starts until you log in
```

The command prints your current lingering state as it runs, so you'll know if that last line is still needed.

Now open `http://your-host:4444/ui`, log in with the API key, and add an app. An app needs a **name** (what you deploy to) and an **entry** — the command that starts it, relative to the artifact, e.g. `node index.js` or `pnpm install && pnpm start`. Environment variables can be edited as a list or pasted as a dotenv blob.

### 2. Deploy from your machine

```bash
gueterbahnhof deploy \
  --host https://your-host:4444 \
  --app-name my-app \
  --api-key pick-something-long \
  --wait \
  ./dist
```

The directory is zipped and uploaded. The server replies immediately with a deployment id and does the work in the background; `--wait` polls until it succeeds or fails and exits non-zero if it didn't.

### 3. Deploy from GitHub Actions

```yaml
- uses: romanlamsal/gueterbahnhof/action@main
  with:
    host: ${{ secrets.GUETERBAHNHOF_HOST }}
    app_name: my-app
    path: ./dist
    api_key: ${{ secrets.GUETERBAHNHOF_API_KEY }}
```

`wait` defaults to `true`, so a failed deployment fails the step.

## CLI

Every flag falls back to an environment variable, and every environment variable can live in the config file instead. Precedence is **flag → environment → `~/.gueterbahnhof`**. Use `--config <path>` to point somewhere else.

### `gueterbahnhof server`

Runs the server: connects pm2, migrates a legacy config if it finds one, starts every configured app, then serves the API and UI.

| Flag | Env | Default |
| --- | --- | --- |
| `--app-dir` | `GUETERBAHNHOF_APP_DIR` | *(required)* |
| `-p, --port` | `GUETERBAHNHOF_PORT` | `4444` |
| `--api-key` | `GUETERBAHNHOF_API_KEY` | *(none — server runs open)* |
| `--config` | — | `~/.gueterbahnhof` |

Without an API key the API and UI are unauthenticated, which is only sane behind a VPN or a firewall.

### `gueterbahnhof deploy <directory>`

Zips the directory and uploads it as the app's new artifact.

| Flag | Env | Default |
| --- | --- | --- |
| `-n, --app-name` | `GUETERBAHNHOF_APP_NAME` | *(required)* |
| `--host` | `GUETERBAHNHOF_HOST` | *(required)* |
| `--api-key` | `GUETERBAHNHOF_API_KEY` | *(none)* |
| `--wait` | `GUETERBAHNHOF_WAIT` | `false` |

Deploying to a name that has no app returns 400 — apps are created in the UI, never by deploying. Only one deployment runs at a time per app; a second one while the first is in flight is rejected with 409.

### `gueterbahnhof logs [app]`

With no argument, the server's own logs from journald. With an app name, that app's logs from pm2.

| Flag | Meaning |
| --- | --- |
| `-n, --lines` | how many lines (default `100`) |
| `-f, --follow` | keep streaming |
| `--errors` | only errors |
| `--unit` | systemd unit name (default `gueterbahnhof`) |

Anything after `--` is passed straight through, so `gueterbahnhof logs -- --since yesterday` and `gueterbahnhof logs my-app -- --raw` work.

### `gueterbahnhof systemd`

Prints a systemd **user** unit on stdout and install instructions on stderr, so `gueterbahnhof systemd > ~/.config/systemd/user/gueterbahnhof.service` is the whole install. Flags: `--config`, `--app-dir`, `--port`, `--description`, `--exec-path`.

The generated unit sets `KillMode=process` on purpose — see the comment inside it.

## HTTP API

The CLI is a client for these; `curl` works just as well. When an API key is set, send it as the `authorization` header.

| Endpoint | Purpose |
| --- | --- |
| `POST /update/:app` | Upload an artifact (multipart, field `artifact`). Responds `202 {"deploymentId":"…"}` |
| `GET /update/:app/status` | State of the latest deployment; add `?deploymentId=…` for a specific one |
| `GET /apps` | Every app as `{id, name, state}` — handy for monitoring |
| `/ui` | The web UI |

Deployment state runs `extracting → starting → succeeded \| failed`. Records are kept in memory only, so a restart forgets them.

## How it behaves

- **Apps run under a real pm2 daemon**, which gueterbahnhof starts if it isn't running and never kills — that daemon may be supervising things that aren't yours. Managed apps carry a `gueterbahnhof` namespace, so `pm2 list` groups them and `pm2 logs gueterbahnhof` streams the whole fleet.
- **Starting an app always recreates it** (stop, delete, start) rather than restarting, because pm2 keeps the environment a process was started with and a plain restart can silently run stale config.
- **Stopping the server stops your apps**, and only yours. The daemon and anything you started yourself keep running.
- **Deploying replaces the app's directory wholesale**, then restarts it. Artifacts live at `<app-dir>/apps/<id>/`, config next to them at `<app-dir>/apps/<id>.json`, with an optional `<id>.env` sidecar merged on top.
- **`PM2_HOME` is honoured** if you set it, and inherited by the daemon — that's how you get a fully isolated pm2 instead of sharing `~/.pm2`.
- Upgrading from a pre-1.0 install migrates `apps.json` automatically on first boot and renames it to `apps.json.migrated`.

## Development

```bash
pnpm install
pnpm --filter server-tanstack dev      # UI + API, needs GUETERBAHNHOF_DIR
pnpm --filter server-tanstack test
pnpm exec turbo run build --filter @lamsal-de/gueterbahnhof   # builds the publishable CLI
```

`packages/server-tanstack` is the server (TanStack Start), `packages/client` the deploy client, `packages/cli` the published bundle of both. Only the CLI is published. Architectural decisions live in `docs/adr/`, the domain glossary in `CONTEXT.md`.
