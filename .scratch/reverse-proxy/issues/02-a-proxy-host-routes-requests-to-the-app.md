# 02 — A Proxy Host routes requests to the App

**What to build:** The feature itself. An App Config gains a Proxy Host — the public hostname that App answers on — and setting one is what makes the App reachable through Gueterbahnhof. Give an App a Proxy Host and a Port, point a hostname at the server, and requests for that hostname reach the App: normal requests, streaming responses, server-sent events and websockets.

An App with no Proxy Host is never routed to, which is every App that exists today, so upgrading and changing nothing is a no-op. A request whose host matches nothing falls through to the Management API exactly as it does now, so the UI and the deploy endpoint are untouched.

Design and reasoning: [spec](../spec.md).

**Blocked by:** 01 — the proxy has to know which port to target.

**Status:** implemented

## Routing

- [x] The App Config carries an optional Proxy Host, and configs already on disk still parse
- [x] The host is taken from `X-Forwarded-Host` when present, otherwise `Host`, and matched exactly against declared Proxy Hosts
- [x] A matched request is proxied to the App's effective port on loopback
- [x] An unmatched host reaches the static handler and then the Management API, exactly as before this ticket
- [x] The routing table is derived from App Configs and refreshed on a short interval, so a newly deployed App becomes routable without restarting the server
- [x] Changing an App's Proxy Host does **not** recreate its process — routing is Gueterbahnhof's concern and live connections must survive it

## The hop

- [x] The proxy is mounted ahead of the static handler, so a proxied App's own `favicon.ico` and `robots.txt` are answered by the App and not from Gueterbahnhof's public directory
- [x] Websocket upgrades are proxied, including for a client whose first contact is the upgrade itself
- [x] The host resolver reads only the request, since no response object exists during an upgrade
- [x] Streaming responses and server-sent events pass through without being buffered
- [x] The proxy target is always an absolute loopback address with a port validated as an integer in range — a missing or malformed port must be rejected rather than producing a target that re-enters our own application
- [x] A matched App with nothing listening returns a 502 naming the App, derived from the failed connection rather than from a liveness check

## The form

- [x] The App's form has a Proxy Host input
- [x] The input states that leaving it empty means no host-based proxying

## Ships and documents

- [x] The declared Node floor is stated explicitly, so an unsupported runtime fails at install rather than at runtime
- [x] An ADR records why routing is a declared field rather than an Env variable, naming the collision that killed the earlier design

## Tests

- [x] Host matching is covered as a pure function, including header precedence and the no-match case
- [x] Proxy behaviour is asserted through the Stationmaster against a real throwaway upstream: a matched host is answered by the upstream, an unmatched host falls through, `X-Forwarded-Host` beats `Host`, a matched host with nothing listening returns a 502 naming the App, and a path that also exists in the public directory reaches the App
- [x] Not-recreating-on-Proxy-Host-change is covered where config-change detection is already tested
- [x] No test runs a process manager
