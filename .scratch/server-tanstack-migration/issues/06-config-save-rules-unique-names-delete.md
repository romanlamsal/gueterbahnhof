# 06 — Config save rules, unique names, delete

**What to build:** The app config form becomes trustworthy. Saving restarts the app only when something process-relevant changed: name or entry change → stop and start; env change → stop **and delete** the process before starting (pm2 caches env); an untouched save is a no-op for the process. App names are unique — saving or creating a duplicate name is rejected with a visible error, keeping by-name deploys unambiguous. Deleting an app asks for confirmation, then removes everything: the managed process, the config file, the env sidecar, and the extracted app directory.

**Blocked by:** 02 — Deploy tracer bullet (uses the artifact store's app-directory handling).

**Status:** ready-for-agent

- [ ] Restart decision (none / restart / recreate) is a pure domain function with unit tests for each rule
- [ ] Saving with only cosmetic changes does not touch the process; env change recreates it
- [ ] Duplicate app name on create or rename → rejected, error shown in the UI
- [ ] Delete: confirm dialog → process stopped and removed, config + sidecar + app directory gone, UI navigates back to the list
- [ ] App-service tests cover cleanup ordering with fake process manager and stores; repository/artifact-store deletions tested against real fs
