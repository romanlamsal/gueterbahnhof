import type { AppConfig } from "@/interface-services/app-config-repository.ts"

// What a config save means for the running process:
// - 'none': nothing process-relevant changed
// - 'restart': stop the old process, start with the new spec
// - 'recreate': stop AND delete the process before starting — pm2 caches env
//   on the process, a plain restart would keep the old values
export type RestartDecision = "none" | "restart" | "recreate"

const envChanged = (prev: AppConfig["env"], next: AppConfig["env"]) => {
    const prevKeys = Object.keys(prev)
    const nextKeys = Object.keys(next)

    return prevKeys.length !== nextKeys.length || prevKeys.some(key => prev[key] !== next[key])
}

export const decideRestart = (prev: AppConfig, next: AppConfig): RestartDecision => {
    if (envChanged(prev.env, next.env)) {
        return "recreate"
    }

    if (prev.name !== next.name || prev.entry !== next.entry) {
        return "restart"
    }

    return "none"
}
