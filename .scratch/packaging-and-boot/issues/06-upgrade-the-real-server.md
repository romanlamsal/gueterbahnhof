# 06 — Upgrade the real server and verify

Type: task (HITL — runs on Roman's box)
Status: open
Blocked by: 05

## Question

Install 1.0.1 on the production host and confirm the destination is actually reached.

Checklist to hand over:

1. Note the current state first: which of the 7 apps are running, and keep a copy of `apps.json` (it holds live secrets — keep it off shared channels).
2. Install 1.0.1 globally; start the server.
3. Confirm **without making any request**: boot logged, pm2 connected, migration ran (per-app configs written, artifact dirs moved, `apps.json.migrated` present), apps started.
4. Confirm each app is `online` via `GET /apps` and reachable on its own port.
5. Confirm app logs carry `YYYY-MM-DD HH:mm:ss` timestamps.
6. Restart once and confirm the second boot is a migration no-op and apps come back.

Resolution records: what happened, anything that needed manual intervention, and whether the destination is met. If the migration misbehaves on real data, capture the failure and open a follow-up ticket rather than patching blind.
