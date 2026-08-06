# 05 — Delete the two exports nothing calls

Type: task
Status: resolved
Blocked by: none — can start immediately

## Question

Two survivors of the pre-daemon design, each widening an interface and inviting a path nothing exercises:

- `app-services/app-service.ts` — `startOrReload`, zero callers anywhere. Deploy, boot and save all go through `recreateAppProcess`.
- `domain/deployment.ts:48` — `canStartDeployment`, called only by `domain/deployment.test.ts:65-69`. Production asks `isInFlight` (`deployment-service.ts:95`).

Delete both, and the test that keeps the second alive. Confirm by grep that nothing else references them, then run the suite.

Nothing to decide unless the grep says otherwise — if either turns out to have a caller, stop and re-open the question rather than deleting.

## Answer

Both deleted after a final grep confirmed neither had a caller anywhere in the workspace.

- `startOrReload` is gone from the App service. Deploy, boot and save all reach `recreateAppProcess` directly.
- `canStartDeployment` is gone from the Deployment domain, along with the test that was its only caller. The equivalent assertions now go through `isInFlight`, which is what production actually asks — so the behaviour stays covered while the interface shrinks.

Two interfaces narrower, one restart path, one in-flight question. 139 tests (one fewer, by deletion), typecheck and biome clean.
