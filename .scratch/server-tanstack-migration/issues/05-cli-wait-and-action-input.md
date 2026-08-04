# 05 — CLI `--wait` and Action `wait` input

**What to build:** `gueterbahnhof deploy <dir>` stays fire-and-forget by default: zip, upload, print the deployment id from the 202, exit 0. With `--wait`, the client polls the per-app status endpoint until the Deployment reaches `succeeded` (exit 0) or `failed`/timeout (exit non-zero, printing the reason) — so a CI job that opts in turns red when a deploy fails. The repo's GitHub Action gains a `wait` input defaulting to `true`, passed through to the CLI.

**Blocked by:** 03 — Deploy guardrails (needs terminal states and failure reasons on the status endpoint).

**Status:** ready-for-agent

- [ ] Default deploy exits 0 right after the 202 and prints the deployment id
- [ ] `--wait` polls status until terminal state; failure/timeout → non-zero exit with the reason; supports an env fallback like the other flags
- [ ] Waiting correlates by deployment id (a later deployment's status is not mistaken for this one's)
- [ ] The GitHub Action exposes `wait` (default true) and passes it through
- [ ] Client wait behavior is tested over real HTTP against a controller backed by fakes — no real server-side pm2
