# 02 — A typo is refused where it was made

**What to build:** Saving an App whose Env names a Fleet Env key that does not exist is refused, with the reason shown on the form — the same place a duplicate App name is reported today. Type `$fleet.supabse_url`, hit Save, and you are told immediately instead of discovering an App that has quietly gone to "stopped".

This is the primary signal for a mistyped reference. Ticket 01's refusal to start is the backstop for a reference that breaks later, and it is deliberately not the main channel: `AppState` has no error state, so an App refusing to start is indistinguishable from a stopped one on screen.

Design and reasoning: [spec](../spec.md).

**Blocked by:** 01 — validation needs to know which keys exist.

**Status:** implemented

## The guard

- [x] Saving an App Config whose Env references an unknown Fleet Env key is refused, and the App Config is not written
- [x] The refusal names the missing key
- [x] The reason reaches the form through the channel that already reports a name clash — no new UI
- [x] A save whose references all resolve behaves exactly as before this ticket
- [x] "Which App Env values reference which keys" is one pure function, the same one tickets 01 and 03 use — the guards cannot disagree because there is only one of them

## Tests

- [x] The scan is covered as a pure function: an App referencing a key twice, several Apps referencing one key, a reference beside literal text, and an App referencing nothing
- [x] The save refusal is asserted through the App service with its existing fakes, including that nothing was written
- [x] A valid save is asserted to still succeed, so the guard cannot become a blanket refusal
- [x] The form's rendering of the reason is covered where save failures are already covered
