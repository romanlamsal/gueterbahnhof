import { mkdirSync } from "node:fs"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { appStateService } from "@/interface-services/app-state-service.ts"
import { migrateLegacyAppsJson } from "@/interface-services/legacy-migration.ts"
import { getPm } from "@/interface-services/pm2-process-manager.ts"
import { getEnv } from "@/runtime/env.ts"
import { getAppService, getAppsDir } from "@/runtime/services.ts"

// Headless boot: create the app directory or fail fast — never prompt.
try {
    mkdirSync(getAppsDir(), { recursive: true })
} catch (error) {
    console.error(`Could not create app directory '${getAppsDir()}':`, error)
    process.exit(1)
}

await getPm().then(async () => {
    console.log("PM2 connected in no-daemon mode.")

    appStateService.init()

    migrateLegacyAppsJson(getEnv().GUETERBAHNHOF_DIR, getAppsDir())

    await getAppService().startAllApps()
})

// Dies-together lifecycle (ADR-0002): wipe managed processes exactly once.
// pm2's in-process daemon installs its own SIGTERM/SIGINT handlers that exit
// synchronously and would preempt the wipe — remove them, we own shutdown.
let wipeStarted = false
for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.removeAllListeners(signal)
    process.on(signal, () => {
        if (wipeStarted) {
            return
        }
        wipeStarted = true

        console.log(`Received ${signal}, shutting down.`)

        getAppService()
            .wipeAllApps()
            .catch(error => console.error("Failed to wipe apps on shutdown:", error))
            .then(() => process.exit(0))
    })
}

export default createServerEntry({
    fetch(request) {
        return handler.fetch(request)
    },
})
