---
"@lamsal-de/gueterbahnhof": minor
---

The server package now starts itself. Everything between "the arguments are known" and "the process is serving" — applying the environment, booting the fleet, installing shutdown handlers, assembling HTTP and listening — moved out of the CLI into a single entry, the Stationmaster. The `server` command is argv parsing and nothing else.

No behaviour change: same flags, same environment variables, same startup message, same exit codes, same shutdown. The startup path has tests for the first time.
