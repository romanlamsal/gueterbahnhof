# 03 — Edit the Fleet Env in one place

**What to build:** A page in the management UI for the Fleet Env: see every value, add one, change one, delete one. Rotating a shared credential becomes one edit, and the Apps that reference it restart themselves — only those, not the whole Fleet.

Two things the page refuses. A key whose name could never be referenced, because an entry no App can use is not worth storing. And deleting a key that Apps still reference, naming the Apps, so tidying up cannot quietly break something.

Design and reasoning: [spec](../spec.md).

**Blocked by:** 02 — reuses the same reference scan, and the App-side guard should exist before the Fleet Env becomes easy to change.

**Status:** implemented

## The page

- [x] The management UI has a Fleet Env page listing every value, behind the same session as the rest of the UI
- [x] Values are editable as dotenv text, reusing the existing dotenv formatting and parsing so quoting behaves exactly as it does for an App's Env
- [x] The App form's Env editor is left untouched
- [x] Values are shown in plain text — editing one requires seeing it
- [x] The file is created owner-only when it does not exist yet (carried over from ticket 01, which only reads)

## Changing

- [x] Saving a changed value recreates exactly the Apps whose Env references that key
- [x] Apps that reference nothing that changed keep running, undisturbed
- [x] A value added or changed is resolved by the next start of a referencing App without restarting the server

## Refusing

- [x] A key name that does not match the reference grammar is refused at save, with a reason
- [x] Deleting a key that Apps still reference is refused, and the reason names those Apps
- [x] Deleting a key nothing references succeeds

## Tests

- [x] Which Apps get recreated on a change is asserted through the service, with the process manager substituted — the referencing Apps are recreated and the others are not
- [x] The delete refusal is asserted, including that the reason names the referencing Apps, and that an unreferenced key deletes cleanly
- [x] Key-name validation is covered as a pure check, including a name that would be unreferenceable
- [x] No *service* test reads or writes a real Fleet Env file — the repository is substituted through its port. The repository's own tests do use real files, deliberately, which is where the permission and round-trip behaviour is asserted
