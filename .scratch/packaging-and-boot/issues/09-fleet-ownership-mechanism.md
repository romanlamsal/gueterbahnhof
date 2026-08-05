# 09 — Fleet ownership: how do we address only our own processes?

Type: grilling
Status: open
Blocked by: none — can start immediately

## Question

08's namespace answer is withdrawn (see its Correction): pm2 resolves `stop`/`delete`/`restart`/`describe` by name across **all** namespaces, so on the shared `~/.pm2` our operations can reach a foreign process that happens to share an app name. We still need "only the fleet" to be structural.

Candidates:

1. **Address by `pm_id`, filter on namespace ourselves.** Keep `namespace: "gueterbahnhof"` as the ownership marker, but never pass a name to pm2: for each operation call `pm2.list()`, filter to our namespace (and the app name within it), and operate on the numeric `pm_id`. Real isolation; app names stay exactly as they appear today in `pm2 list` and log filenames. Costs: every adapter method becomes list-then-act (one extra round-trip), ids must be resolved immediately before use, and `start` needs checking for how it behaves when a foreign process already holds the same name (`force` may be required).
2. **Prefix the process names** (`gbhf-<name>`). Name-addressed operations become safe because our names are distinct by construction — a one-line mapping in the adapter, no list-then-act anywhere. Cost: the names you see in `pm2 list` and in log filenames change, and the prefix leaks into operator-facing output.
3. **Own `PM2_HOME`** (rejected earlier in 08 for visibility reasons). Total isolation: separate daemon, separate registry, collisions impossible. Cost: apps no longer appear in the operator's default `pm2 list`/`pm2 logs` without setting `PM2_HOME`.

Whichever wins, ticket 05's rehearsal must prove it with a deliberately colliding foreign process: start a dummy pm2 app under the same name as one of ours, then confirm our boot, our delete and our shutdown all leave it untouched.
