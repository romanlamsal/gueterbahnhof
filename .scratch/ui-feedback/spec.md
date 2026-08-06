# Spec: app config form feedback and UI cleanup

Status: ready-for-agent

Decided in a grilling session on 2026-08-06 from a batch of UI feedback. Two of the seven reported items turned out to be already-working behaviour masked by wiring bugs; one turned out to be impossible in pm2. The rest is the work.

## Problem Statement

Saving an App Config gives no sign that anything happened — no pending state, no confirmation. Worse, two things in that form are wired up wrong and fail silently:

1. **Dotenv edits are discarded.** The dotenv tab's textarea is rendered without its change handler, so anything typed or pasted there never reaches state and never gets saved. This is why env changes appeared not to restart the App: the change never arrived in the first place.
2. **Save feedback never fires.** The existing save button only shows its confirmation when an `onClick` handler returns a promise, but the form submits via `type=submit` with no such handler. The code that would show a green check has never run.

Alongside that, the UI carries template leftovers: a burger menu wrapping a drawer with exactly one link, the document title still reading "TanStack Start Starter", and no favicon.

## Solution

One Save that persists name, Entry and Env together, with a visible outcome; a dotenv textarea whose contents actually count; a copy button that yields text safe to paste anywhere; and a header, title and favicon that say what this is.

## User Stories

1. As an operator, I want the Save button to show a spinner and go disabled while saving, so that I know the click registered and cannot double-submit.
2. As an operator, I want a green checkmark next to the button after a successful save, so that I know the change reached the server.
3. As an operator, I want that checkmark to fade away after a few seconds, so that stale confirmation never makes me think a later edit was saved.
4. As an operator, I want a failed save to show a red message in the same place the checkmark would appear, so that I only have one place to look for the outcome.
5. As an operator, I want a failure message to stay until I change something, so that it does not vanish before I have read it.
6. As an operator, I want everything I typed in the dotenv tab to be saved when I press Save, so that my edits are never silently dropped.
7. As an operator, I want one Save button covering name, Entry and Env together, so that there is no second step to remember.
8. As an operator, I want the list tab and the dotenv tab to show the same Env after I switch between them, so that I can trust either view.
9. As an operator, I want my App restarted when I change its Env, so that the running process actually uses the new values.
10. As an operator, I want my App restarted when I change its Entry, so that the new command takes effect.
11. As an operator, I want renaming an App to keep it running under the new name with no leftover process under the old one.
12. As an operator, I want a copy button next to the dotenv textarea, so that I can move an App's Env somewhere else without selecting text by hand.
13. As an operator, I want the copied text URI-escaped, so that values containing quotes, newlines or `#` survive being pasted into another tool.
14. As an operator, I want the copy button to confirm it copied, so that I am not left wondering whether the click worked.
15. As an operator, I want a header showing "gueterbahnhof 🚂" instead of a burger menu hiding one link, so that navigation matches how little there is to navigate.
16. As an operator, I want the browser tab titled "gueterbahnhof 🚂", so that I can find it among many open tabs.
17. As an operator, I want a favicon, so that the tab is recognisable when its title is truncated.
18. As a maintainer, I want a test covering the form's wiring, so that a handler silently going missing fails the build rather than reaching production.

## Implementation Decisions

### Save outcome

- The existing save button component is refactored to be **driven by the mutation's state** rather than by an `onClick` that happens to return a promise. It takes the current status — idle, saving, saved, error — plus an optional message, and renders: a lucide spinner inside the button next to its label with the button disabled while saving; a green lucide check beside the button on success, fading out after roughly three seconds; a red message beside the button on failure, which persists until the next edit or save attempt.
- The status comes from the existing react-query mutation, which already tracks pending, success and error. No separate state machine is introduced.
- The current red "name already taken" text under the Name field moves into this shared outcome slot, so success and failure appear in the same place.

### Dotenv tab

- The textarea is wired to its change handler. Its text is parsed into Env state **on blur** — switching tabs or clicking Save both blur it — and **again at submit**, so a Save while the textarea still has focus cannot lose the last keystrokes.
- There is **no Apply button**: one Save persists name, Entry and Env together.
- Parsing continues to use the existing dotenv round-trip helper, so quoting, comments, multi-line values and values containing `=` behave exactly as they do everywhere else.

### Copy button

- Sits next to the dotenv textarea and copies the Env **always URI-escaped**, regardless of the tab's Escaped toggle, since that form survives pasting into any tool. It reuses the same escaping helper as the textarea.
- Uses the same fading-check confirmation as Save, for one visual language.
- The Escaped toggle therefore becomes purely a viewing preference; it stays.

### Chrome

- The burger menu and its drawer are removed. A slim header showing "gueterbahnhof 🚂" and linking to the app list replaces them.
- The document title becomes "gueterbahnhof 🚂".
- The favicon is an inline SVG data URI carrying the 🚂 emoji, so no binary asset is added and it works at any size.

### Already correct — do not change

- **Env and Entry changes already restart the App.** The app service recreates the process (stop, delete, start) on either change, with tests asserting it. The reported failure was the discarded dotenv edits, above.
- **pm2 cannot rename a process in place** — no rename exists in its API. Stopping and deleting the old name, then starting under the new one, is the only route and is what the app service already does.

## Testing Decisions

A good test here asserts what an operator would notice, not how the component is built: what ends up in the saved payload, and what the screen says afterwards. Neither of the two bugs this spec fixes was a logic error — both were handlers that silently went missing — so the test must exercise the form as a user does.

- **One component test** on the app config form, using jsdom and testing-library, both already devDependencies. It covers: text typed into the dotenv tab appears in the payload passed to the save mutation; a resolving save shows the confirmation; a rejecting save shows the message. The server function is stubbed at the module boundary, so no server, pm2 or network is involved.
- The vitest config runs in a node environment, so this file opts into jsdom with a per-file docblock rather than changing the default for the whole package.
- **No new tests** for escaping, parsing or restart behaviour: the dotenv round-trip helper and the app service already cover those, and duplicating them through the UI would test the same logic twice.
- Prior art: the existing pure-function and app-service tests in this package, and the deliberate absence of browser tests recorded in the migration spec.

## Out of Scope

- Any change to when an App restarts — that behaviour is already correct.
- Renaming a pm2 process in place, which pm2 does not support.
- A toast or notification system.
- Restyling the form beyond the outcome slot and the header.
- Tests for the clipboard API itself.

## Further Notes

- Both bugs live in the same component and both are "a handler that was never passed". Worth a glance at the rest of that file for a third.
- The save button component's existing three-second timer and lucide check are kept; what changes is what drives them.
