# 06 — Three answers, two behaviours

Type: grilling
Status: resolved
Blocked by: none — can start immediately

## Question

`domain/app-config-change.ts:8` promises `none | restart | recreate`. `app-services/app-service.ts:139` asks only `!== "none"`, and the comment above it concedes the distinction is moot. `domain/app-config-change.test.ts` pins a difference nothing observes — a module whose interface is wider than the behaviour behind it.

Decide which way to close the gap:

1. **Narrow the interface** to the question actually asked — `needsRecreate(prev, next): boolean` — and simplify its tests. Safe: the behaviour on the wire is unchanged.
2. **Honour the three-way answer** — let `restart` mean a restart again, with only env changes recreating. This contradicts ADR-0003's recreate-on-boot reasoning (pm2 keeps the environment a process started with) and is **ruled out of scope** unless that ADR is reopened as its own effort.

The first is the expected outcome; the ticket exists to make it a decision rather than a drive-by edit, and to record why the second was refused.

## Answer

**Narrowed**, as expected — option 2 stays out of scope.

`decideRestart(prev, next): "none" | "restart" | "recreate"` becomes `needsRecreate(prev, next): boolean`, which is the question `updateAppConfig` was already asking. The caller loses the comment conceding that it ignored the distinction, and the tests stop pinning a difference nothing observes: six cases now, each asserting a real consequence.

The reasoning behind the three-way answer has not been lost — it lives where it belongs, in the module's comment and in ADR-0003: recreate rather than restart, because pm2 keeps the environment a process was started with. Honouring a `restart` that genuinely restarts would contradict that ADR, which is why it was ruled out of scope rather than decided here.
