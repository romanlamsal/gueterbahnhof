# Spec: Fleet Env — values held once, referenced by the Apps that need them

Status: ready-for-agent

Decided in a grilling session on 2026-08-10. Depends on nothing outstanding; the `filter_env` fix in 1.4.1 is what makes the isolation claims here true at all.

## Problem Statement

Every App that talks to the same thing carries its own copy of the credential for it. One Supabase project serves basically the whole Fleet, and its connection string is pasted into every App's Env; one AWS account does too, and today each App has its own key pair, created and rotated by hand.

The cost is not typing, it is that there is no single place to change anything. Rotating the Supabase password means finding every App that mentions it and editing each one, with no way to tell whether you got them all. Adding an App means copying a secret out of another App's form, which is also the only place it exists. And because every value is stored per App, a secret appears in as many App Configs as there are Apps using it.

## Solution

Values that belong to the whole Fleet get one home — a **Fleet Env**, edited on its own page — and an App's Env refers to them rather than repeating them:

```ini
# Fleet Env
supabase_url=postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
aws_key=AKIA...
aws_secret=...

# App "scrumpoker" Env — stores references, never values
DATABASE_URL=$fleet.supabase_url?options=-c search_path=scrumpoker
AWS_ACCESS_KEY_ID=$fleet.aws_key
AWS_SECRET_ACCESS_KEY=$fleet.aws_secret
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/scrumpoker
```

A reference resolves when the App's process is started, so the App receives a real value while the App Config holds only the reference. Rotating the Supabase password becomes one edit in one place, and the Apps that depend on it restart themselves.

**The reference is the opt-in.** There is no inheritance list to maintain and no way for an App to receive a value it did not name. An App with no references is unaffected by the feature existing, which is every App today.

**The App names its own variable.** One Fleet Env value can arrive as `DATABASE_URL` in one App and `PG_URL` in another, and interpolation means the per-App part — a schema, a prefix, a suffix — stays in the App where it belongs.

**AWS needs nothing else from Gueterbahnhof.** The shared half is the key pair; the per-App half is an ordinary `AWS_ROLE_ARN` value. The App assumes its role itself with three lines of SDK code, and the SDK refreshes the credentials on its own — there is no case for Gueterbahnhof knowing what AWS is.

## User Stories

1. As an operator, I want one place to hold a value every App uses, so that changing it is one edit rather than a search.
2. As an operator, I want an App's Env to refer to a Fleet Env value, so that the value is not copied into every App that needs it.
3. As an operator, I want to see the reference in an App's form rather than the secret, so that the secret is not on screen every time I look at an App.
4. As an operator, I want to choose the variable name in each App, so that one shared value can arrive as `DATABASE_URL` in one App and something else in another.
5. As an operator, I want to put a reference in the middle of a value, so that one Supabase connection string plus a per-App schema needs only one Fleet Env entry.
6. As an operator, I want to write `${fleet.name}` when a literal follows immediately, so that a trailing `_dev` is not swallowed into the name.
7. As an operator, I want to rotate a shared credential in one place and have the Apps using it pick it up, so that rotation does not leave half the Fleet on the old value.
8. As an operator, I want only the Apps that reference a changed value to restart, so that rotating one credential does not take down the whole Fleet.
9. As an operator, I want a save that names a Fleet Env key which does not exist to be refused with a message on the form, so that a typo is caught where I made it rather than becoming a silently stopped App.
10. As an operator, I want deleting a Fleet Env key that Apps still reference to be refused and to be told which Apps, so that tidying up cannot quietly break something.
11. As an operator, I want an App whose reference cannot be resolved to refuse to start with a reason in the log, so that it never runs with a half-substituted value.
12. As an operator, I want a Fleet Env key whose name cannot be referenced to be refused at save, so that I cannot create an entry no App could ever use.
13. As an operator, I want references to work in the dotenv sidecar as well as the form, so that the two ways of setting an App's Env behave the same.
14. As an operator, I want the Fleet Env file to be readable only by me, so that a shared credential is not sitting in a world-readable file.
15. As an operator, I want Apps with no references to be completely unaffected, so that upgrading changes nothing until I choose to use this.
16. As an operator, I want one IAM key pair for the whole Fleet with a role per App, so that I stop creating and rotating a key pair per App.
17. As an operator, I want the per-App role ARN to be ordinary App Env, so that the thing that differs per App lives with the App.
18. As a maintainer, I want reference parsing to be a pure function, so that the grammar is tested exhaustively without a filesystem.
19. As a maintainer, I want "which Apps reference this key" to be one pure function, so that the save guard, the delete guard and the restart selection cannot disagree.
20. As a maintainer, I want the Fleet Env behind a hand-written repository port, so that no test touches a real file to exercise resolution.
21. As a maintainer, I want resolution to happen where the process spec is built, so that every path that starts an App gets it without remembering to.
22. As a maintainer, I want the Fleet Env never to enter Gueterbahnhof's own environment, so that the inheritance route closed in 1.4.1 cannot reopen and hand every App every value.
23. As a maintainer, I want no recursion in resolution, so that a value containing a reference is a literal and there are no cycles to detect.
24. As a future contributor, I want an ADR saying references are resolved rather than inherited, and saying plainly what this does and does not protect against, so that per-App reach is not mistaken for a security boundary.

## Implementation Decisions

**A Fleet Env is a set of named values held once for the whole server**, stored as a dotenv file beside the App Configs, behind a hand-written repository port. It is read on demand and **never** placed into Gueterbahnhof's own environment — that is the route 1.4.1 closed, and putting Fleet Env there would hand every value to every App regardless of references.

**The file is created with owner-only permissions**, and a permission that is not owner-only is warned about, matching how the server config file already behaves when it holds a secret.

**Reference grammar.** `$fleet.name` with `name` matching `[A-Za-z0-9_]+` greedily, and `${fleet.name}` for when a literal must follow immediately. References may appear anywhere in a value, any number of times, mixed with literal text. Resolution is a single pass: a Fleet Env value that itself contains a reference is a literal, so there is no recursion and no cycle detection.

**Fleet Env key names are constrained to the reference grammar** and a save that violates it is refused. A key that cannot be referenced is an entry no App could ever use.

**Resolution happens when the process spec is built**, alongside the port injection that already lives there, so every path that starts an App — reconciliation, a deploy, a config save — gets it without having to remember. The App Config on disk always holds the reference; only the process receives the value.

**References work wherever an App's Env comes from.** The dotenv sidecar is merged into the Env before anything sees it, so resolution covers both without knowing which is which.

**One scan, three uses.** "Which App Env values reference key X" is a single pure function over App Env values, and it drives all three guards: refusing a save that names an unknown key, refusing to delete a key that is still referenced, and choosing which Apps to recreate when a value changes. They cannot disagree because there is only one of them.

**An unresolvable reference is caught twice.** At save time the App service refuses the change and returns a reason, which the App form already renders — that is the channel that shows a name clash today, and it puts the message where the typo was made. At start time, a reference that has broken since — the key was deleted, a config was hand-edited — refuses to start the App with a reason, rather than passing a half-substituted value to a process. Start-time refusal is the backstop, not the primary signal, because the UI has no error state to show it in: `AppState` is `online | stopped | pending | no-artifact`, so a refusing App is indistinguishable from a stopped one on screen.

**Changing a Fleet Env value recreates exactly the Apps that reference it.** `needsRecreate` compares two App Configs and a Fleet Env change touches none of them, so the fleet-env save path triggers the recreates itself, using the scan. Apps that do not reference the changed key keep running.

**Deleting a Fleet Env key that Apps reference is refused, naming them.** Renaming is delete-plus-create and inherits the same guard.

**The Fleet Env page is its own editor.** The App form's Env editor stays exactly as it is: it has a history of silently broken handlers, it is wired to an App, and the parsing that matters is already shared. The new page reuses `formatEnvs`/`parseEnvs` for dotenv round-tripping, so what can differ between the two editors is affordances — list view, escaped toggle, copy button — never dotenv semantics.

**The UI shows Fleet Env values in plain text**, because editing a value requires seeing it, and the page sits behind the same session the rest of the management UI does.

**Gueterbahnhof gains no knowledge of AWS or Supabase.** No config files written on an App's behalf, no STS calls, no credential endpoint. A shared key pair plus a per-App role ARN plus three lines in the App is the whole AWS story, and the SDK's own refresh handles expiry.

**Glossary and decision record.** `CONTEXT.md` gains `Fleet Env` and `Fleet Env Reference`; "shared secret" stays reserved for the API Key, which is what it already means there. A new ADR records that values are referenced rather than inherited, why the reference is the opt-in, and the honest limits below.

## Testing Decisions

**What makes a good test here.** The behaviours that matter are: an App receives the resolved value while its config still holds the reference; an App with no references is untouched; a typo is refused at save with a message; a broken reference keeps an App down instead of running it with rubbish; changing a value restarts the referencing Apps and only those; and a referenced key cannot be deleted. Each is observable without knowing how the file is parsed or how the scan is written. A test asserting the repository was consulted, or that the resolver was called with a particular object, is asserting plumbing.

**The grammar is tested as a pure function, exhaustively**, because it is the part most likely to be subtly wrong: bare and braced forms, a reference at the start, middle and end of a value, several in one value, a greedy name against a trailing literal, the braced form rescuing that case, an unknown name, a malformed reference, a value with no reference at all, and a Fleet Env value containing something that looks like a reference staying literal.

**The scan is tested as a pure function**, including an App referencing a key twice, several Apps referencing one key, and a reference living in a value alongside literal text.

**Resolution is asserted where the process spec is built**, so the assertion is that the process receives the value and the config still holds the reference.

**Guards are asserted through the existing service seams** — the App service for the save refusal, with the process manager substituted as it already is; the fleet-env service for the delete refusal and for which Apps get recreated when a value changes.

**No test reads or writes a real Fleet Env file**; the repository is substituted through its port. The repository's own file handling gets its own test, in the way the App Config repository's already does.

**Prior art.** `app-port.ts` and `proxy-route.ts` are the model for pure domain functions with exhaustive tests. `app-service.test.ts` substitutes the process manager and asserts on resulting state. `app-config-repository.test.ts` is the model for testing real file handling. The App form already renders a `SaveOutcome` message, and its tests already cover that path for a name clash.

## Out of Scope

- Any enforcement against a hostile App. See the limits below.
- Masking or reveal-on-click for values on the Fleet Env page.
- Per-App visibility rules beyond "did this App reference it".
- Referencing anything other than a Fleet Env value — no references to other App Env values, no references to server settings, no shell expansion.
- Nesting, recursion or cycle detection.
- Versioning, history or audit of Fleet Env changes.
- Rotation scheduling, expiry or reminders.
- Any AWS-specific or Supabase-specific behaviour: no written credential files, no STS calls, no credential endpoint.
- Editing the Fleet Env from the CLI or over the API. The page is the surface.
- Warning about a Fleet Env key that no App references.

## Further Notes

**What this protects against, and what it does not.** A Fleet Env value never appears in an App Config, an App's form, a deploy payload, or anything committed to a repository, and an App cannot receive a value it did not reference. It is not proof against a hostile App: the resolved value enters the pm2 process environment, pm2 persists that, and every App runs as the same OS user in sibling directories — so an App that can reach the pm2 daemon can read every App's environment, and one that can read the App Directory can read the Fleet Env file itself. Per-App reach is an organisational boundary — smaller blast radius by default, clearer intent — not an enforced one. Real enforcement needs a UID per App, which is a different project. This belongs in the ADR in these words, because the feature reads like a security control and is not one.

**Why references rather than injection.** Two earlier designs were rejected. Injecting the whole Fleet Env into every App was simplest but gave every App every credential. Injecting per an `inherits` list on each App Config was explicit but made the operator maintain a list, forced the Fleet Env key name to be the variable name, and could not express the per-App part of a value — the Supabase schema — at all. References solve all three at once: the opt-in is implicit and exact, the App names its own variable, and interpolation puts the per-App part in the App.

**Why `AWS_ROLE_ARN` alone does not work**, recorded because it is the obvious thing to try. The SDK's static-credentials provider resolves usable credentials from `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` and the chain stops there; `AWS_ROLE_ARN` is not read by it. The docs are explicit that `role_arn` additionally requires one of `source_profile`, `credential_source` or `web_identity_token_file` — and the two that fit this case are shared-config-file settings with no environment variable. So zero-App-change assume-role would require Gueterbahnhof to write an AWS config file per App; three lines of `fromTemporaryCredentials` in the App avoids that entirely and refreshes automatically.

**dotenv does not expand anything.** Verified: `parse` returns `$fleet.x`, `${fleet.x}/db` and `$A/tail` verbatim, and `needsQuoting` in `env-format.ts` does not treat `$` specially. The reference syntax is ours alone, and references round-trip through both the list view and the dotenv textarea untouched.
