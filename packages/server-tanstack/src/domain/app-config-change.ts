import type { AppConfig } from "@/interface-services/app-config-repository.ts"

// Does a saved App Config change require the process to be recreated?
//
// Recreated, never restarted: pm2 keeps the environment a process was started
// with, so a restart can silently run an App with stale Env (ADR-0003). The
// caller asks one question, so this answers one.
const envChanged = (prev: AppConfig["env"], next: AppConfig["env"]) => {
    const prevKeys = Object.keys(prev)
    const nextKeys = Object.keys(next)

    return prevKeys.length !== nextKeys.length || prevKeys.some(key => prev[key] !== next[key])
}

// Port is compared because it lives outside the Env now: without this an App
// would keep binding the old port after the field changed. Anything routing
// related must NOT be compared — the App does not need telling where requests
// come from, and re-pointing a hostname must not drop live connections.
export const needsRecreate = (prev: AppConfig, next: AppConfig) =>
    envChanged(prev.env, next.env) || prev.name !== next.name || prev.entry !== next.entry || prev.port !== next.port
