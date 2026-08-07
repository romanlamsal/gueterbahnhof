# 03 — An empty Port is assigned automatically

**What to build:** The operator stops choosing ports. Clear the Port on an App that has a Proxy Host, save, and Gueterbahnhof picks one, remembers it, and routes to it. The Port input's promise that an empty value is filled in for you becomes true at this point.

This is the first thing Gueterbahnhof ever persists that the operator did not type, so the guard rails matter more than the feature. Assignment happens only for an App that declares a Proxy Host and resolves to no port at all — which is no App that exists today. An App with a Port, or with `PORT` in its Env, is never a candidate and is never probed, so nothing pinned to an external route can move.

Design and reasoning: [spec](../spec.md).

**Blocked by:** 02 — assignment is gated on a Proxy Host, and without that gate it would start assigning ports to every App on the host.

**Status:** implemented

## Choosing

- [x] Candidates are drawn in order from 20000–20999, a range below the kernel's ephemeral floor so an outbound connection cannot steal a port between the check and the bind
- [x] Ports already claimed by any App Config — in its Port field or its Env — are skipped, as is the port Gueterbahnhof itself listens on
- [x] Each candidate is checked for availability before it is taken, so a foreign process on the host does not produce an App that fails on every boot with nothing the operator can fix
- [x] Exhausting the range fails with a reason rather than silently producing no port
- [x] The availability check sits behind a hand-written interface-service port, per ADR-0005, because it is the seam a test substitutes

## Claiming

- [x] Assignment happens only for an App that declares a Proxy Host and resolves to no port
- [x] An App with a Port keeps it and is never probed
- [x] An App with `PORT` in its Env keeps it and is never probed
- [x] An App with no Proxy Host is untouched, including its Env
- [x] Assignment runs as a serialized pass **before** the fleet is started, so two Apps starting concurrently cannot be handed the same port
- [x] Each assignment is persisted before the next candidate is considered, so the claim is durable rather than a race between probes
- [x] Assignment persists through the App Config repository rather than the App service, so writing a port does not recurse into recreating the App being started
- [x] An assigned port is reused on the next boot rather than chosen afresh
- [x] An assigned port that has become unavailable fails loudly, the same as one that was typed

## The form

- [x] The Port input states that leaving it empty means a port is assigned automatically when a Proxy Host is set
- [x] An assigned port appears in the Port input once chosen

## Tests

- [x] Candidate selection is covered as a pure function: ordering, exclusions, and exhaustion of the range
- [x] Assignment is asserted through Fleet reconciliation with the process manager and the availability check substituted — an App with a Proxy Host and no port gets one persisted before it starts, an App with a Port is untouched, an App with only an Env `PORT` is untouched, an App with no Proxy Host is untouched, two eligible Apps get different ports, and a port claimed by another App is skipped
- [x] No test binds a real socket for the availability check, and no test runs a process manager
