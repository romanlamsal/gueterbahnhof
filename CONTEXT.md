# Gueterbahnhof

A low-level, self-hosted deployment server: you POST an artifact against its API and it runs the contained app under a process manager. Updating an app means POSTing a new artifact, which stop-updates-starts the app. The name is German for "freight yard" — a place where cargo arrives and gets dispatched.

## Language

**App**:
A named, long-running process that Gueterbahnhof manages: one artifact, one app config, one process. The central entity of the whole system.
_Avoid_: Service, process (alone), project

**Artifact**:
A zip of a directory containing everything an app needs to run. The unit of deployment — deploying means uploading a new artifact for an app.
_Avoid_: Bundle, build, package

**Deploy**:
POSTing an artifact for a named app, causing a stop-update-start of that app. Idempotent from the caller's view: the same call creates or replaces.
_Avoid_: Publish, upload (alone), release

**Deployment**:
A single artifact update for one app, from upload through extract and start to a terminal outcome (succeeded or failed). At most one deployment is in flight per app at a time.
_Avoid_: Update (as a noun), rollout, release

**Fleet**:
All the Apps one Gueterbahnhof server manages, considered together — what boot reconciles and what a graceful shutdown stops. Excludes processes on the same host that this server did not configure.
_Avoid_: The apps (when the collective is meant), cluster

**Server Config**:
The server's own settings — App Directory, port, API Key — as opposed to an App Config, which belongs to a single App. Supplied by flag, environment variable, or config file, in that order of precedence.
_Avoid_: Config (unqualified), settings

**App Config**:
The persisted settings of an app: its name, its entry, and its env. Exists independently of whether an artifact has been deployed yet.
_Avoid_: App settings, service config

**Entry**:
The relative path inside an app's artifact that the process manager executes to start the app.
_Avoid_: Script, main, index (the legacy server and the pm2 API say "script"; the domain term is entry)

**Env**:
The set of environment variables an app config carries, injected into the app's process on start.
_Avoid_: Environment config, variables

**App Directory**:
The server-side directory where Gueterbahnhof keeps its state: extracted artifacts and app configs live beneath it. Configured at server start.
_Avoid_: appDir, GUETERBAHNHOF_DIR (those are the flag/env spellings, not the term)

**App State**:
The observed runtime condition of an app (e.g. started/online, stopped, pending, errored). Derived from the process manager, never persisted.
_Avoid_: App status (pick one; "state" is the term)

**Management API**:
The HTTP surface for operating the server: deploying artifacts, inspecting apps, and the UI. Protected by the API Key when one is set.
_Avoid_: Admin API, control plane

**API Key**:
A single shared secret that authorizes both programmatic deploys and UI login.
_Avoid_: Token, password

**Process Manager**:
The underlying supervisor that actually starts, stops, and watches app processes. Currently pm2; apps should not need to know.
_Avoid_: pm2 (in domain-level conversation), daemon

**Client**:
The code that packs a directory into an artifact and deploys it to a Gueterbahnhof server — used from the CLI or the GitHub Action.
_Avoid_: Deployer, agent

**CLI**:
The single published binary (`@lamsal-de/gueterbahnhof`) bundling both roles: `server` starts a Gueterbahnhof server, `deploy` acts as a client.
_Avoid_: Tool, binary

**Proxy Host**:
The public hostname an App answers on, declared as a field of its App Config. Setting one is what makes an App reachable through Gueterbahnhof; an App without one is never routed to. Gueterbahnhof's knowledge, not the App's — it is never injected into the App's Env.
_Avoid_: Virtual host, domain, route, GUETERBAHNHOF_HOST (that name belongs to the deploy client, for the server's own URL)

**Port**:
The port an App binds, declared as a field of its App Config and injected into its process as `PORT`. An App configured before the field existed says it with a `PORT` in its Env instead, and that still resolves — the field simply wins.
_Avoid_: Listen port, app port

**Assigned Port**:
A Port that Gueterbahnhof chose, because the App declared a Proxy Host and named no port itself. Persisted on the App Config like any other Port, so it is stable across restarts rather than picked afresh. The only value Gueterbahnhof ever writes that the operator did not type.
_Avoid_: Random port, dynamic port, ephemeral port (that means the kernel's own range, which this deliberately avoids)

**Stationmaster**:
What owns the running server process: it boots the Fleet, wires up HTTP, installs the shutdown handlers and listens. Lives in the server package and is handed its settings already parsed — the CLI decides what they are, the Stationmaster decides what to do with them.
_Avoid_: Host, host entry, runtime, entry (Entry means an App's start path)
