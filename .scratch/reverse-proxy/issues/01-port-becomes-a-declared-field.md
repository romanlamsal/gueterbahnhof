# 01 — Port becomes a declared field

**What to build:** An App's port stops being a variable that happens to be in its Env and becomes a field of its App Config, edited in the App's own form next to its name and entry. Whatever port an App ends up with is injected into its process as `PORT`, so the App still learns it the only way an App can.

`PORT` disappears from the Env editor, because with a dedicated field two places to edit it can only disagree. The Port input prefills from an inherited Env value and says where it came from, so the form always shows the port the App actually runs on; saving promotes that value to a real field and drops the Env copy, without the App's port changing.

Nothing about proxying yet, and nothing existing moves: an App that carries `PORT` in its Env today keeps running on exactly that port whether or not anyone opens its form.

Design and reasoning: [spec](../spec.md).

**Blocked by:** None — can start immediately.

**Status:** implemented

## The field

- [x] The App Config carries an optional Port, and every App Config already on disk still parses with no migration step
- [x] The Port is settable through the existing config update path without a new endpoint or new validation
- [x] An App's effective port resolves as `config port`, then `Env PORT` — so an App with only an Env `PORT` is unaffected by this change
- [x] The effective port reaches the App's process as `PORT` when its process spec is built
- [x] Gueterbahnhof never writes into an App's Env to record a port

## Restart semantics

- [x] Changing an App's Port recreates its process, so it actually binds the port that was asked for
- [x] Changing anything that does not affect the running process still does not recreate it

## The form

- [x] The App's form has a Port input alongside name and entry
- [x] When the App Config has no Port but its Env does, the input prefills with that value and shows that it was inherited
- [x] `PORT` is not listed in the Env editor, in either the list view or the dotenv view
- [x] Saving a form whose Port was inherited promotes it to the App Config field and submits an Env without `PORT`, leaving the effective port unchanged
- [x] An App whose form is never opened keeps running on its Env `PORT`

## Tests

- [x] Port resolution is covered as a pure function, including an App with `PORT` only in its Env
- [x] The effective port is asserted to reach the process spec
- [x] Recreate-on-port-change is covered where config-change detection is already tested
- [x] The form's prefill, the absence of `PORT` from the Env editor, and promotion on save are covered in the existing form tests
- [x] No test runs a process manager
