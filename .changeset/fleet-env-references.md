---
"@lamsal-de/gueterbahnhof": minor
---

**Fleet env: values held once, referenced by the apps that need them.** A new Fleet env page holds values that belong to the whole server — a Supabase connection string, an AWS key pair — and an app's env refers to them instead of repeating them:

```
DATABASE_URL=$fleet.supabase_url?options=-c search_path=scrumpoker
```

The reference is the opt-in. No inheritance list, no way for an app to receive a value it did not name, and an app with no references is unaffected — which is every app until you use it. The app picks its own variable name, and because a reference can sit anywhere in a value, the per-app part (a schema, a prefix) stays with the app. Use `${fleet.name}` when a literal follows immediately.

Values are resolved on the way to the process, so an app config keeps the reference and a shared credential never appears in a config, a form or a deploy payload.

Rotating a value is one edit: saving it restarts exactly the apps that reference it, and leaves the rest running. A key that apps still reference cannot be removed — you are told which apps. A mistyped reference is refused when you save the app, naming the key, rather than becoming an app that has quietly stopped.

This also covers one AWS key pair for the whole fleet with a role per app: share the pair as fleet env, put the role ARN in the app's own env, and let the app assume it with `fromTemporaryCredentials` — the SDK refreshes on its own.
