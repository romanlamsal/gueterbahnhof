---
status: accepted
---

# Routing is declared on the App Config, and a Port is never overridden

An App is reachable through Gueterbahnhof when its App Config declares a **Proxy Host**. That is the whole opt-in: no server-level flag, and no App Config on disk has one, so the feature is inert until somebody sets it. The **Port** is a declared field too, resolved as `config port → Env PORT`, and injected into the App's process as `PORT` when its process spec is built.

Requests are matched on `X-Forwarded-Host` and then `Host`, exactly, against the declared Proxy Hosts. A host nobody declared falls through to the static handler and then the Management API, exactly as before the proxy existed.

## Consequences

- **The first design put the hostname in the App's Env, and the name was already taken.** `GUETERBAHNHOF_HOST` is the deploy client's name for the *server's* URL — passed by the GitHub Action, documented in the README. An App's Env reaches that App's process, so an App that deployed anything would have inherited a variable pointing at its own hostname instead of at a server. Declared fields cannot collide with a variable namespace they are not in.
- **Beyond the collision, it is the better model.** A Proxy Host is something *Gueterbahnhof* needs to know, not something the App needs told. Nothing is injected: an App that wants to know its own public name can still be told through its Env, under a name its operator picks.
- **Changing a Proxy Host does not restart the App; changing a Port does.** `needsRecreate` compares the Port, because it left the Env and an App must rebind to honour a new one, and deliberately ignores the Proxy Host, because re-pointing a hostname must not drop live connections. Under the Env design every route change recreated the process, since any Env change does.
- **Gueterbahnhof stopped writing into an App's Env.** The Port field is the source of truth and the injection happens when the process spec is built. Everything persisted into an App's Env is still something the operator typed.
- **`PORT` is filtered out of the Env editor, and that is what migrates it.** Two places to edit one value can only disagree. The Port input prefills from an inherited Env value, so the form shows what the App actually runs on, and saving submits that port with an Env that no longer carries it — promoting it without the effective port changing. An App whose form is never opened keeps resolving through the Env fallback, which is why an upgrade cannot move an App that is pinned in somebody's nginx.
- **A stopped App answers 502 because the connection is refused, not because we asked.** The routing table records intent, so liveness is discovered by trying. That is always current, costs the request path nothing, and means "the App is down" needs no separate code path.
- **The routing table is polled, not pushed.** Nothing can tell the Stationmaster that a config changed — the UI writes them through a different module instance — so the table is rebuilt from App Configs on a short interval. Lookups stay synchronous against the last snapshot, because every asset of every proxied page does one.
- **A duplicated Proxy Host resolves to the first App declaring it**, deterministically, rather than to whichever config the directory happened to yield first.
- **Adopting the proxy library raises the supported Node floor** to 22.15, now declared in `engines` so an unsupported runtime fails at install rather than at runtime.
