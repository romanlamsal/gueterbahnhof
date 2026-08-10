import type { StartOptions } from "pm2"
import type { AppProcessSpec } from "./process-manager.ts"

// The spec -> pm2 mapping, split out from the adapter so it can be asserted
// without importing pm2 at runtime. The import above is type-only and erases.

// Prefix every app log line with a readable timestamp (24h).
const LOG_DATE_FORMAT = "YYYY-MM-DD HH:mm:ss"

// A grouping label, NOT a boundary: pm2 resolves stop/delete/describe by name
// across every namespace, so this only groups the fleet in `pm2 list` and
// enables `pm2 stop gueterbahnhof` as a manual lever. See ADR-0004.
export const FLEET_NAMESPACE = "gueterbahnhof"

// pm2 hands an app OUR entire process.env and then layers the app's own env on
// top (its Common.js builds `app.env = [{}, process.env, app.env]`). Our
// configuration lives in that environment — the API Key included, because the
// built server reads it from there — so without filtering, every App can read
// it and deploy as any other App. That was verified against a real deploy: the
// app printed GUETERBAHNHOF_API_KEY back.
//
// A non-empty array makes pm2 filter process.env rather than pass it wholesale,
// dropping any name containing one of these strings and leaving PATH, HOME and
// the rest alone. It must be an array: pm2's string form deletes from
// process.env in place.
export const FILTERED_ENV_SUBSTRINGS = ["GUETERBAHNHOF_"]

export const toStartOptions = (spec: AppProcessSpec): StartOptions => ({
    name: spec.name,
    script: spec.entry,
    cwd: spec.cwd,
    env: spec.env,
    filter_env: FILTERED_ENV_SUBSTRINGS,
    namespace: FLEET_NAMESPACE,
    log_date_format: LOG_DATE_FORMAT,
})
