# Spec: The Stationmaster owns HTTP and the fleet lifecycle

Status: ready-for-agent

Decided in a grilling session on 2026-08-07. This is the first of two commits; the second is the reverse proxy, which this refactor exists to make tractable. Nothing here changes observable behaviour.

## Problem Statement

The CLI package is supposed to parse argv. Instead, it is where the HTTP server lives: the `server` command sets environment variables for the built server, boots the Fleet, installs signal handlers, constructs an express app, serves the static directory, mounts the nitro middleware, and listens. The server package — the one actually named after the server — cannot start itself.

Three consequences follow, in ascending order of cost:

1. Changing how the server is assembled means editing the CLI, which is where flag parsing lives, so two unrelated concerns share a file and a package.
2. Nothing in the server package can participate in request handling above the nitro app, because the layer above it belongs to a different package.
3. Any future server concern that needs to sit in front of nitro — routing, proxying, host matching — is forced to choose between being written in the CLI, where it does not belong, or being contorted into the nitro app, where it does not fit.

The third is not hypothetical. The reverse-proxy work that follows this spec ran directly into it: proxying belongs in front of the static handler, the static handler is mounted in the CLI, and the only way to intercept from inside the server package is to wrap the nitro app's internal fetch handler. That workaround was proven to work, and rejected, because the seam was wrong rather than the technique.

## Solution

`server-tanstack` gains a single entry — the **Stationmaster** — that accepts parsed parameters and is self-sufficient from that point on. It owns everything between "the arguments are known" and "the process is serving": environment application, Fleet boot, signal handling, HTTP assembly, and listening.

The CLI's `server` command shrinks to what a CLI should do: define flags, validate them, resolve where its own bundled server output sits on disk, and make one call.

An operator sees no difference. The same flags, the same environment variables, the same startup log, the same exit codes, the same shutdown behaviour.

## User Stories

1. As a maintainer, I want the HTTP server to be assembled inside the server package, so that changing how requests are handled does not mean editing the CLI.
2. As a maintainer, I want the CLI's `server` command to be argv parsing and nothing else, so that its responsibility is obvious from its size.
3. As a maintainer, I want the server package to be startable from a single function call, so that its contract with the outside world is one signature rather than a sequence of steps a caller must perform in the right order.
4. As a maintainer, I want the boot-then-listen ordering to live in one place, so that a caller cannot accidentally listen before the Fleet is reconciled.
5. As a maintainer, I want signal handling to travel with the code that starts the server, so that a new caller cannot forget to install it.
6. As a maintainer, I want to add a request-handling concern in front of the nitro app without touching the CLI, so that server work stays in the server package.
7. As a maintainer, I want the Stationmaster's collaborators to be substitutable, so that the startup path can be tested without a process manager or a production build.
8. As a maintainer, I want a test that proves the Fleet is booted before the server listens, so that a refactor cannot silently reintroduce a server that serves with no Apps running.
9. As a maintainer, I want a test that proves a boot failure prevents listening, so that a broken server never accepts traffic while pretending to be healthy.
10. As a maintainer, I want a test that proves the Fleet is stopped exactly once on a termination signal, so that the double-signal guard cannot regress unnoticed.
11. As a maintainer, I want the static handler and the nitro middleware to mount in a defined, asserted order, so that the ordering the reverse proxy depends on is written down rather than assumed.
12. As an operator, I want `gueterbahnhof server` to behave exactly as it does today, so that upgrading across this change is uneventful.
13. As an operator, I want the same startup message on the same port, so that my existing health checks and eyeballs keep working.
14. As an operator, I want a missing App Directory to still fail immediately with the same message, so that my systemd unit's failure mode does not change.
15. As an operator, I want a missing server bundle to still fail loudly as a packaging error, so that a bad install is still distinguishable from a bad configuration.
16. As an operator, I want a Fleet boot failure to still exit non-zero, so that systemd still restarts me rather than leaving a useless process listening.
17. As an operator, I want `SIGTERM` and `SIGINT` to still stop my Apps and leave the process manager's daemon alone, so that the guarantee ADR-0003 gave me survives the refactor.
18. As an operator running under systemd, I want journald priority prefixes to keep working, so that `journalctl -p err` still surfaces real failures.
19. As a future contributor, I want the server package to declare its own HTTP dependency, so that reading its manifest tells me it serves HTTP.
20. As a future contributor, I want code that runs outside the nitro bundle to be visibly separated from code that runs inside it, so that I do not import the wrong one and get a confusing build failure.
21. As a future contributor, I want an ADR that says which component owns the lifecycle, so that I do not have to reconstruct the reasoning from the call graph.
22. As a future contributor, I want the glossary to name the Stationmaster, so that "the server" stops being ambiguous between the package, the process, and the nitro app.
23. As an agent picking up the reverse-proxy work, I want the HTTP assembly to already be in the server package, so that the proxy is a small diff rather than a cross-package rewrite.
24. As an agent reviewing this change, I want it to contain no behaviour change, so that any failure after it lands is attributable to the next commit.
25. As a maintainer, I want the packaging bundler to keep working unchanged, so that the published binary is built the same way it is today.

## Implementation Decisions

**A new Stationmaster module in the server package.** It exports one function that takes the App Directory, the port, the API Key, and the location of the built server output, and returns once the process is listening. Everything the CLI's `server` command does after flag validation moves into it.

**The server output location is a parameter, not a discovery.** Only the CLI knows its own published layout, so it resolves that path and its existence check stays on the CLI side. This is the one genuinely packaging-shaped concern, and it is the only reason the Stationmaster takes a fourth parameter.

**The Stationmaster is not part of the nitro bundle.** It imports the built server output and an HTTP framework, so the nitro build must never reach it — building it into its own output is circular. This category already exists in the repository: the Fleet lifecycle and the composition factory are server-package source that the CLI bundler pulls into the CLI binary rather than nitro pulling into its output. The Stationmaster joins that category.

**That category gets a directory of its own and a comment that says why.** Nothing mechanically prevents a route from importing the Stationmaster and breaking the nitro build with a confusing error, so the mitigation is a dedicated directory whose name marks the boundary plus a comment at the top of the module. A lint rule was considered and declined as disproportionate for a two-module category; if the footgun ever fires, the rule is the escalation.

**Collaborators are defaulted parameters, not injected dependencies.** Fleet boot, Fleet shutdown, and loading the built middleware are parameters whose defaults are the real implementations. This is the idiom the journald prefix module already uses — real behaviour by default, substitutable in a test — and it avoids both a container and a test-only code path.

**The CLI's `server` command keeps flag definitions, required-flag validation, the version log, and server-output resolution.** Required-flag validation stays manual, consistent with how this repo uses its CLI library.

**Mount order is preserved exactly as it is today**: static assets first, then the nitro middleware. The reverse-proxy commit changes this deliberately; this commit must not, so that the two changes remain separable. The order becomes an asserted property rather than an incidental one.

**All failure modes and exit codes are preserved**: a missing App Directory reports the same message and sets the same exit code, a missing server bundle exits as a packaging error, and a Fleet boot failure exits non-zero before anything listens. The double-signal guard is preserved.

**The HTTP framework dependency moves to the server package's manifest.** It is currently a CLI dependency that the CLI bundler inlines. After the move the server package is the one that imports it. The bundler's existing behaviour — inline everything except the process manager — is unchanged, and the published manifest continues to declare only the process manager.

**The documentation for this decision is already written and committed ahead of the code.** ADR-0006 records why HTTP assembly belongs in the server package, carries the rejected nitro-plugin alternative with the evidence against it, and explains the naming. ADR-0003 is amended rather than superseded — its substance holds, and only its attribution changes from the CLI owning the lifecycle to the Stationmaster owning it. `CONTEXT.md` already carries the `Stationmaster` term. The implementer does not need to write any of this; they need to not contradict it.

## Testing Decisions

**What makes a good test here.** This commit changes no behaviour, so the tests are not there to prove the move worked — they are there to pin the properties that the move makes it possible to state, and that the next commit will build on. A good test asserts something an operator or the next commit depends on: that boot precedes listening, that failure prevents listening, that a signal stops the Fleet once, that the handlers mount in a known order. A bad test asserts that a particular function was called with a particular shape of object, which would break on any future re-plumbing while proving nothing.

**One seam.** `server-command` has no test today, so there is no existing seam to prefer and nothing to reuse. The refactor introduces exactly one: the Stationmaster's exported function. Everything worth asserting about startup is observable through it, so no lower seam is proposed — the composition factory, the Fleet lifecycle, and the process manager port all keep the coverage they already have.

**The tests never run a process manager and never load a production build.** Fleet boot and shutdown are substituted with recording doubles; the middleware loader is substituted with a trivial handler. This follows the established rule for this repository and matches how the logs command is tested as a pure mapping without the tools it drives being present.

**Cases to cover through that seam**: the Fleet is booted before the server listens; a boot rejection propagates and nothing listens; a termination signal stops the Fleet, and a second signal does not stop it again; the static handler is registered before the nitro middleware; the configured port is the one listened on; and the API Key parameter reaches the environment the built server reads while an absent one leaves it unset.

**Prior art.** The systemd command's tests render a unit file and assert properties of the result rather than the rendering steps. The logs command is tested as a pure options-to-argv mapping, deliberately so it can be tested without journalctl or pm2 installed. The journald module takes its environment and target as parameters specifically because a first version passed for the wrong reason. All three are the pattern to follow: push the interesting decision somewhere it can be observed directly, then assert the observation.

**What is not tested.** That the real built middleware serves the real UI — that is an end-to-end concern, covered today by running the binary, and this commit does not change it. The verification for the move itself is that the server still boots, serves the UI, and round-trips a deploy.

## Out of Scope

- The reverse proxy itself: host matching, `GUETERBAHNHOF_HOST`, the routing table, and the 502 for a matched-but-stopped App. That is the next commit, and this one must not anticipate it beyond making the mount order explicit.
- Port assignment, the candidate range, and the availability probe. Also the next commit.
- TLS termination. It becomes structurally possible once HTTP assembly lives in the server package, and it is not attempted here.
- Websocket support, including the upgrade handler. It becomes possible for the same reason and is part of the proxy commit.
- Any change to what `vite dev` does. Dev has never exercised this path — the CLI is the only entry that boots the Fleet — and that divergence is pre-existing and accepted.
- Any change to Fleet semantics, the process manager port, or the composition factory.
- Making the server output location discoverable rather than passed in.
- Raising the declared Node floor. That question arrives with the proxy's dependency, not here.

## Further Notes

**A viable fallback was proven and set aside.** Before the seam was questioned, a spike established that a nitro plugin can intercept every request ahead of the router by wrapping the nitro app's fetch handler — confirmed against a production build, with host matching working from both `X-Forwarded-Host` and `Host`, and unmatched requests falling through to the management UI untouched. It works, and it is documented here so that nobody re-derives it: if the Stationmaster ever proves unworkable, that is the fallback. It was rejected because it intercepts *behind* the static handler, which would let gueterbahnhof's own `favicon.ico` and `robots.txt` answer a proxied App's requests, and because it forecloses websockets.

**What the spike ruled out.** The nitro app's h3 instance exposes no public middleware registration — route-verb methods exist, but the middleware array is private. So "register an h3 middleware from a plugin" is not available in this version, and the fetch wrap is the only interception point that uses documented API.

**The invisible category is the real risk in this change.** After it lands, the server package's source contains code compiled into the nitro output, code compiled into both, and code that must never reach the nitro build. Only the third is new, and only a directory name and a comment distinguish it. If this bites, the escalation is a lint rule forbidding imports of that directory from anywhere the nitro entry can reach.
