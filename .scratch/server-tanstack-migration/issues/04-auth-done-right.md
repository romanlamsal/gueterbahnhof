# 04 — Auth done right

**What to build:** When an API key is configured, every management route actually requires it — unlike the legacy server, where the check registered too late and the first deploy went through unauthenticated. API callers (deploy, status, apps list) send the key in the authorization header. The UI has a login page that exchanges the key for a signed httpOnly session cookie whose value is cryptographically verified on every request — possession of the cookie name or a fabricated value grants nothing. With no key configured, everything stays open (trusted-network mode).

**Blocked by:** 02 — Deploy tracer bullet (happy path).

**Status:** resolved

- [x] With a key configured: API routes without a valid authorization header → 401/403, including the very first request after boot
- [x] UI routes without a valid session redirect to login; login with the correct key sets a signed httpOnly cookie and redirects back
- [x] A tampered or fabricated cookie is rejected (signature verified, not presence-checked)
- [x] With no key configured: API and UI are fully usable unauthenticated
- [x] Session signing/verification is an interface service with its own unit tests; controllers tested for 401/403/redirect via the HTTP handler
