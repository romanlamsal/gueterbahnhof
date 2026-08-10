# 01 — References resolve into a running App

**What to build:** A Fleet Env exists as a file the server reads, and an App's Env can refer to its values. Put `DATABASE_URL=$fleet.supabase_url?options=-c search_path=scrumpoker` in an App's Env, and the App's process receives the real connection string with the schema appended — while the App Config on disk still holds only the reference.

Resolution happens where the process spec is built, so every path that starts an App gets it: reconciliation, a deploy, a config save. An App with no references is untouched, which is every App today.

A reference that names nothing keeps the App down with a reason rather than handing a process a half-substituted value.

No UI in this ticket — the Fleet Env is a file, edited by hand. Design and reasoning: [spec](../spec.md).

**Blocked by:** None — can start immediately.

**Status:** implemented

## The Fleet Env

- [x] The server reads a Fleet Env from a dotenv file beside the App Configs, behind a hand-written repository port
- [x] A permission that is not owner-only is warned about, the way the server config file already behaves when it holds a secret
- [ ] The file is *created* owner-only — deferred to ticket 03, which is where the write path lives; this ticket only reads
- [x] The Fleet Env is never placed into Gueterbahnhof's own environment — that route was closed in 1.4.1 and would hand every value to every App regardless of references
- [x] A missing Fleet Env file is an empty Fleet Env, not an error

## The grammar

- [x] `$fleet.name` resolves, with the name matching `[A-Za-z0-9_]+` greedily
- [x] `${fleet.name}` resolves, so a literal may follow a reference immediately
- [x] A reference may appear at the start, middle or end of a value, and more than once in one value, mixed with literal text
- [x] Resolution is a single pass: a Fleet Env value that itself contains a reference stays literal, so there is no recursion and nothing to detect cycles in
- [x] A value with no reference is passed through byte for byte

## Reaching the process

- [x] The resolved value reaches the App's process; the App Config on disk still holds the reference
- [x] References resolve whether the Env came from the config or the dotenv sidecar
- [x] An App with no references is completely unaffected, including its Env
- [x] An App naming a key that does not exist refuses to start, with a reason naming the key

## Tests

- [x] The grammar is covered exhaustively as a pure function: both forms, every position, several in one value, a greedy name against a trailing literal, the braced form rescuing that case, an unknown name, a malformed reference, no reference at all, and a Fleet Env value containing something reference-shaped staying literal
- [x] Resolution is asserted where the process spec is built — the process gets the value, the config keeps the reference
- [x] Refusing to start on an unknown reference is asserted through Fleet reconciliation, with the process manager substituted as it already is
- [x] No test reads or writes a real Fleet Env file; the repository's own file handling is tested separately, the way the App Config repository's is
