# Spec: Gueterbahnhof as a reverse proxy for its own Apps

Status: ready-for-agent

Decided in a grilling session on 2026-08-07. This is the second of two commits and depends on [the Stationmaster refactor](../stationmaster/spec.md) having landed, which is what puts HTTP assembly inside the server package where this work belongs.

## Problem Statement

Gueterbahnhof runs Apps but does not route to them. An App listens on a port on the host, and something else — today, nginx — has to be told about that port and kept in sync with it by hand. So the operator maintains two systems that must agree: Gueterbahnhof knows what is running, nginx knows how to reach it, and nothing enforces that these two beliefs match.

The coupling is worse than duplication, because the port is the thing they agree on and the port is fragile. It must be chosen by hand for every App, recorded in two places, and kept unique across every App on the host. Getting it wrong produces a 502 that looks like an application failure. And because the port must be pinned in nginx, Gueterbahnhof cannot help by choosing one — anything it picked automatically would break the route that was pinned to the old value.

The result is that deploying a new App is not one action. It is a deploy, plus a port decision, plus an nginx edit, plus a reload.

## Solution

An App Config gains two declared fields: a **Proxy Host** and a **Port**. Setting a Proxy Host is what makes an App reachable through Gueterbahnhof, and leaving the Port empty is what makes Gueterbahnhof choose one. Both are edited in the App's form, alongside its name and entry, rather than buried in its Env.

Routing therefore becomes a property the operator declares, not a variable that happens to be present. It also stops colliding with anything: an earlier draft of this spec put the hostname in the App's Env as `GUETERBAHNHOF_HOST`, which is already the deploy client's name for the *server's* URL — passed by the GitHub Action and documented in the README. Since an App's Env is injected into that App's process, an App that deployed anything would have inherited a variable pointing at its own hostname instead of at a server. Declared fields have no such problem.

Everything else is unchanged. An App with no Proxy Host is never routed to and never has a port chosen for it, which is every App that exists today. Upgrading without editing anything is a no-op that can be reasoned about rather than tested for. A request whose host matches no App falls through to the Management API exactly as it does now.

## User Stories

1. As an operator, I want an App's public hostname to be a field on its config, so that routing is something I declare rather than something I encode in a variable.
2. As an operator, I want to set that hostname in the same form where I set the App's name and entry, so that I do not have to think about which variables are magic.
3. As an operator, I want to deploy a new App and have it reachable without touching nginx, so that deploying is one action instead of four.
4. As an operator, I want an empty Port to mean "choose one for me", so that I stop tracking which ports are taken.
5. As an operator, I want the form to say that an empty Port is auto-assigned and an empty Proxy Host means no proxying, so that the empty states are self-explaining rather than something I have to remember.
6. As an operator, I want an assigned port to be shown in the form once chosen, so that I can see what it picked without reading the process table.
7. As an operator, I want an assigned port to stay the same across restarts, so that anything that did learn the port is not broken by a reboot.
8. As an operator, I want a Port I typed to be honoured exactly, so that an App whose port is pinned somewhere outside Gueterbahnhof keeps working.
9. As an operator, I want my existing Apps that carry `PORT` in their Env to keep running on exactly that port after upgrading, so that the nginx routes I have today do not move.
10. As an operator, I want the port shown in the form to be the port the App actually runs on, so that the form never lies to me about an inherited value.
11. As an operator, I want `PORT` to disappear from the Env editor once there is a Port field, so that there is exactly one place to change it and the two cannot disagree.
12. As an operator, I want an App whose Port is already taken to fail loudly rather than silently move, so that my external route does not start returning 502 while Gueterbahnhof reports success.
13. As an operator, I want that failure to name the reason, so that I can tell "something else is on this port" from "the App crashed on boot".
14. As an operator, I want a stale process holding a port to be surfaced rather than routed around, so that I find out about a zombie instead of accumulating them.
15. As an operator, I want Apps with no Proxy Host to be completely unaffected, so that upgrading cannot disturb the Apps I route to by hand today.
16. As an operator, I want to opt one App in at a time, so that I can migrate off nginx incrementally rather than all at once.
17. As an operator, I want changing an App's Proxy Host to take effect without restarting the App, so that re-pointing a hostname does not drop live connections.
18. As an operator, I want changing an App's Port to restart the App, so that it actually binds the port I asked for.
19. As an operator, I want requests for unknown hosts to reach the Management API as they do today, so that the UI and deploy endpoint keep working while I migrate.
20. As an operator, I want the proxy to honour `X-Forwarded-Host` ahead of `Host`, so that Gueterbahnhof works as an inner hop behind an existing edge proxy during migration.
21. As an operator, I want to eventually drop the edge proxy entirely, so that Gueterbahnhof terminates the request itself.
22. As an operator, I want a request for a stopped App to return a clear error naming the App, so that a visitor sees a real explanation rather than a login page for a tool they have never heard of.
23. As an operator, I want a proxied App's own `favicon.ico` and `robots.txt` to be served by the App, so that proxied sites are not silently branded with Gueterbahnhof's assets.
24. As an operator running a websocket App, I want websockets proxied too, so that I do not have to keep a separate route just for that one App.
25. As an operator, I want streaming responses and server-sent events to pass through unbuffered, so that live-updating Apps behave the same proxied as they do direct.
26. As an operator, I want a newly deployed App to become routable within seconds without restarting Gueterbahnhof, so that routing keeps up with deploying.
27. As an operator, I want assigned ports drawn from a range that does not collide with the kernel's ephemeral range, so that an outbound connection cannot steal the port my App is about to bind.
28. As a maintainer, I want the new fields to be optional on the App Config schema, so that every config already on disk keeps parsing and no migration step exists.
29. As a maintainer, I want the host-to-App matching rule to be a pure function, so that it can be tested exhaustively without a server.
30. As a maintainer, I want port candidate selection to be a pure function, so that ordering and exclusion rules are tested without touching the network.
31. As a maintainer, I want the availability check behind a hand-written port, so that tests substitute it and no test binds a real socket.
32. As a maintainer, I want port assignment to happen before Apps start rather than during, so that two Apps starting concurrently cannot be assigned the same port.
33. As a maintainer, I want an assigned port persisted before the next App is considered, so that the claim is durable rather than a race between probes.
34. As a maintainer, I want assignment to write through the repository rather than the App service, so that persisting a port does not recurse into recreating the process that is being started.
35. As a maintainer, I want proxy behaviour tested through the Stationmaster with a real upstream, so that the test proves bytes arrive rather than that a function was called.
36. As a maintainer, I want the proxy target built as an absolute address with a validated port, so that a malformed value cannot turn into an internal sub-request that re-enters our own app.
37. As a future contributor, I want an ADR explaining why routing is a declared field rather than a variable, so that the rejected Env-based design is not reintroduced.

## Implementation Decisions

**The App Config gains an optional Proxy Host and an optional Port.** Both are optional, so every config already on disk parses unchanged and there is no migration step. Because the UI's update path validates against the App Config schema in its partial form, both fields become settable through the existing server function the moment the schema knows about them — no new endpoint, no new validation.

**Setting a Proxy Host is the entire opt-in.** There is no server-level feature flag. An App with no Proxy Host is never matched and is never eligible for port assignment, and since no config on disk has one, the feature is inert until someone opts in.

**An earlier design put the hostname in the App's Env and was rejected.** The name it needed was already the deploy client's name for the server's URL, and an App's Env reaches that App's process, so the two meanings would have met. Beyond the collision, a declared field is simply the better model: the Proxy Host is something *Gueterbahnhof* needs to know, not something the App needs told.

**Port resolution has one order, and it protects what exists.**

```
effective port  =  config.port  ??  env.PORT  ??  auto-assign (only when a Proxy Host is set)
```

The Env fallback is what keeps every App that exists today on exactly the port it runs on now: auto-assignment is both the last resort and gated on a Proxy Host, so an App with a hand-set `PORT` and no Proxy Host is never touched. A value typed into the Port field wins over a stale Env one, so the field never appears broken.

**The effective port is injected into the process as `PORT` at start.** The App still learns its port the only way an App can. Gueterbahnhof no longer writes into the App's Env to do it — the field is the source of truth and the injection happens when the process spec is built.

**`PORT` is filtered out of the Env editor.** With a dedicated field, showing it in both places invites them to disagree. Filtering it from the view means the form's submitted Env also omits it, which promotes an inherited value to a real field on the first save: the form sends the port it displayed and an Env without `PORT`, and the effective port does not change. Not saving is equally safe, because the resolution order still finds the Env copy.

**The Port field prefills from the Env when the config field is unset**, labelled as inherited, so what the form shows is what the App runs on.

**The form states what the empty states mean.** An empty Port reads as automatically assigned when a Proxy Host is set; an empty Proxy Host reads as no host-based proxying. These are the two defaults the whole feature turns on, and they are invisible unless the form says so.

**`needsRecreate` starts comparing the Port and deliberately ignores the Proxy Host.** The port now lives outside the Env, so without adding it a port change would not restart the App and it would keep binding the old one. The Proxy Host must be excluded for the opposite reason: routing is Gueterbahnhof's concern, the App does not need telling, and re-pointing a hostname must not drop live connections.

**The host is read from `X-Forwarded-Host` first, then `Host`,** and matched exactly against the declared Proxy Hosts. The forwarded header is what an existing edge proxy sets, which is what makes incremental migration possible.

**A host that matches nothing falls through unchanged**, reaching the static handler and then the Management API exactly as today.

**The routing table is derived from App Configs and cached briefly**, rebuilt on a short interval, which bounds how long a newly deployed App waits to become routable without requiring any invalidation signal.

**A stopped App produces a 502 from the connection failure, not from a liveness check.** The table records intent, so a matched App that is not listening refuses the connection and the proxy's error handler turns that into a 502 naming the App. Always accurate, never stale, and nothing is asked of the process manager on the request path.

**An explicit Port is never overridden.** If it is taken, the App fails to bind and reports it, exactly as today. Nothing pre-checks it: the App's own bind failure is the loud failure, and pre-flighting would only produce a prettier message while adding a check that can be wrong by the time the App binds.

**Assignment applies only to an App that declares a Proxy Host and resolves to no port.** Candidates are drawn in order from a fixed range, skipping any port already claimed by any App Config — whether in its Port field or its Env — and the port Gueterbahnhof itself listens on. Each candidate is checked for availability before being taken. The claimed set prevents Apps colliding with each other; the availability check guards against a foreign process, without which a squatter would make an App fail on every boot forever with nothing the operator could fix by hand.

**The range sits below the kernel's ephemeral floor.** The IANA dynamic range and anything above 32768 on Linux overlaps the range the kernel hands out as source ports for outbound connections, so a "free" port can be taken between the check and the bind, by the host itself. The chosen range is `20000`–`20999`: below that floor, above the commonly squatted application defaults, and clear of the Kubernetes NodePort range.

**Assignment is a serialized pass that runs before Apps are started.** Fleet reconciliation starts every App concurrently, so probing during start would let two Apps observe the same port as free. Resolving and persisting for all eligible Apps first, one at a time, makes each claim visible to the next candidate as persisted state rather than as a race.

**Assignment persists through the App Config repository, not the App service.** The App service recreates a process on a qualifying config change, so persisting through it while starting that same App would recurse. The repository writes the file and nothing else.

**The proxy is mounted in the Stationmaster, ahead of the static handler**, which is what ensures a proxied App's own `favicon.ico` and `robots.txt` reach the App rather than being answered from Gueterbahnhof's public directory.

**Websockets are proxied.** The proxy library handles the upgrade, and the Stationmaster subscribes it to the server's upgrade event, because the library only observes upgrades on its own if an ordinary request has already passed through it. The host resolver must therefore read only the request, since the response object is not present during an upgrade.

**The proxy target is always an absolute loopback address with a validated integer port.** The proxy helper treats a target beginning with a path separator as an internal sub-request that never leaves the process, so a malformed or empty port must be rejected before a target is built rather than degrading into a request that re-enters our own application.

**Layering follows the existing architecture.** Host matching, port resolution and candidate selection are pure and live in the domain layer. The availability check is the only thing that touches the network and becomes a hand-written interface-service port, per ADR-0005, because it is genuinely the seam a test substitutes. The assignment pass is orchestration and lives with the App service. Mounting is composition and lives in the Stationmaster.

**The proxy dependency raises the declared Node floor**, which the CLI does not currently declare at all. The floor is declared explicitly so an unsupported runtime fails at install rather than at runtime.

**Documentation.** The glossary gains `Proxy Host` and `Assigned Port`. A new ADR records why routing is a declared field rather than an Env variable, why an explicit port is never overridden, and why the port range sits below the ephemeral floor.

## Testing Decisions

**What makes a good test here.** The externally meaningful behaviours are: a request for a declared host reaches the App, anything else reaches the Management API, a stopped App produces a 502 that names it, an App with a Proxy Host and no port ends up with one, an App with a port keeps it, and an App with `PORT` only in its Env keeps running on exactly that. Each is observable without knowing how the routing table is built or how a candidate was chosen. A test asserting that the cache was consulted, or that the probe was called with a particular port, is asserting plumbing.

**Existing seams are reused; no new service or host seam is introduced.**

**Port resolution is tested as a pure function** — the `config.port ?? env.PORT ?? assign` order, including the case that matters most: an App with `PORT` in Env and no Proxy Host resolves to the Env value and is never a candidate for assignment.

**Port assignment is tested through Fleet reconciliation**, already a tested seam with a substituted process manager. The cases: an App declaring a Proxy Host and no port has one persisted to its config before it is started; an App with a Port keeps it and is never probed; an App with no Proxy Host is untouched, including its Env; two Apps needing assignment receive different ports; a port claimed by another App — in either its field or its Env — is skipped; and the effective port reaches the process spec as `PORT`.

**Recreate semantics are tested at the domain seam** that already covers them: changing the Port requires a recreate, changing the Proxy Host does not.

**Proxy behaviour is tested through the Stationmaster.** A throwaway HTTP server stands in for a running App, so the assertion is that a response actually arrives. The cases: a matching host is answered by the upstream; a non-matching host reaches the fall-through handler; `X-Forwarded-Host` is preferred over `Host`; a matched host with nothing listening returns a 502 naming the App; and a path that also exists in the public directory reaches the App rather than the static handler.

**The form is tested where it already is.** The Port input prefills from an inherited Env value; `PORT` does not appear in the Env editor; saving an inherited value promotes it to the field and drops it from the submitted Env; and the empty-state help for both fields is present.

**No test binds a real socket for the availability check, and no test runs a process manager.** The one real socket is the upstream stand-in in the Stationmaster tests, which is the point of those tests.

**Prior art.** The App service tests substitute the process manager and assert on resulting state. The domain tests — fleet ownership, App state derivation, Env formatting, config-change detection — are pure and exhaustive, which is the model for matching, resolution and candidate selection. The form already has its own test file. ADR-0005 explains why the new probe gets a hand-written interface and nothing else does.

## Out of Scope

- TLS termination. It is the reason the Stationmaster owns HTTP assembly, and it is separate work involving certificate storage and renewal.
- Path-based routing. Routing is by host only; an App is reached at the root of its own hostname.
- Multiple Proxy Hosts per App, and wildcard or suffix matching. Matching is exact against one declared value.
- Rewriting anything in the proxied response — no cookie domain rewriting, no HTML rewriting, no path rewriting.
- Telling an App its own public hostname. The Proxy Host is Gueterbahnhof's knowledge, not the App's; if an App needs to know, the operator can still put it in the Env under a name of their choosing.
- Any authentication or authorization on proxied requests. A declared Proxy Host is public; the API Key protects the Management API only.
- Releasing an assigned port when an App stops. It stays claimed as long as the config carries it, which is what makes it stable.
- Reassigning an assigned port that has become unavailable. Same rule as a typed one: it fails loudly.
- Removing `PORT` from an App's Env on the operator's behalf. It is filtered from the editor and superseded by the field; it is never deleted behind their back.
- Making the port range or the cache interval configurable.
- Health checking, retries, or upstream connection pooling.
- Serving Apps over anything but loopback.

## Further Notes

**The kernel's ephemeral range is why the range looks unusual.** The local port range on the target host is `32768`–`60999`, and IANA's dynamic range of `49152`–`65535` sits entirely inside it. Choosing from either means competing with the kernel's own source-port allocation, including in the window between checking a port and binding it. The reason belongs in the ADR or it will look like an arbitrary constant.

**Why the availability check survives despite the never-override rule.** It would be tempting to drop it and make candidate selection entirely pure, since the claimed set already prevents Apps colliding with one another. It earns its place only for foreign processes, and only because the resulting failure is unfixable by hand: the operator never chose that port, so there is nothing for them to correct, and the App would fail identically on every boot.

**A rejected placement, recorded so it is not re-litigated.** Proxying inside the nitro application was investigated and proven to work by wrapping the app's internal fetch handler. It was rejected because it intercepts behind the static handler, and because the framework's websocket support is a server abstraction rather than a tunnel, which would have made websocket proxying a hand-written frame-shuttling exercise instead of a configuration option. See ADR-0006.

**The migration path this enables.** With the forwarded-host precedence in place, an existing edge proxy can keep terminating requests and forward to Gueterbahnhof, which routes to the App. The two routing systems can run simultaneously, one App at a time, before the edge proxy is removed.
