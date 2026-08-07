import { resolveAppPort } from "@/domain/app-port.ts"

// The Process Manager port, written by hand so that pm2's vocabulary stops at
// its adapter. Callers speak App names and statuses; nothing here mentions
// ProcessDescription, pm2_env or Proc.

export type AppProcessSpec = {
    name: string
    entry?: string
    cwd?: string
    env?: Record<string, string>
}

// What we know about a process the Process Manager is running for us. `status`
// is whatever the manager reports; deriveAppState maps the ones we care about
// and treats the rest as stopped.
export type ManagedProcess = {
    name: string
    status: string
}

export type ProcessOutcome = { ok: true } | { ok: false; reason: string }

export type ProcessManager = {
    getAppProcess(appName: string): Promise<ManagedProcess | undefined>
    listFleetProcesses(): Promise<ManagedProcess[]>
    startAppProcess(spec: AppProcessSpec): Promise<ProcessOutcome>
    stopAppProcess(appName: string): Promise<ProcessOutcome>
    deleteAppProcess(appName: string): Promise<ProcessOutcome>
    recreateAppProcess(spec: AppProcessSpec): Promise<ProcessOutcome>
}

// Shared config -> process-spec mapping: the App runs inside its App Directory.
//
// The resolved Port is injected here as PORT, because that is the only way an
// App can learn which port to bind. The App Config field is the source of
// truth; Gueterbahnhof never writes the value back into the App's own Env.
export const toProcessSpec = (
    config: { name: string; entry?: string; env?: Record<string, string>; port?: number },
    appDir: string,
): AppProcessSpec => {
    const port = resolveAppPort(config)

    return {
        name: config.name,
        entry: config.entry,
        env: port === undefined ? config.env : { ...config.env, PORT: String(port) },
        cwd: appDir,
    }
}
