import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { createAppService } from "@/app-services/app-service.ts"
import { createAppConfigRepository } from "@/interface-services/app-config-repository.ts"
import { createArtifactStore } from "@/interface-services/artifact-store.ts"
import { migrateLegacyAppsJson } from "@/interface-services/legacy-migration.ts"
import { connectProcessManager, pm2ProcessManager } from "@/interface-services/pm2-process-manager.ts"

// The fleet's lifecycle belongs to whoever owns the process — the CLI — not to
// the request-serving module (ADR-0003). This module is imported by the CLI
// bundle as well as the server, and that duplication is safe precisely because
// the daemon, not a module instance, holds the fleet's state.

const servicesFor = (gueterbahnhofDir: string) => {
    const appsDir = join(gueterbahnhofDir, "apps")
    const configRepository = createAppConfigRepository(appsDir)
    const artifactStore = createArtifactStore(appsDir)

    return {
        appsDir,
        appService: createAppService({ configRepository, artifactStore, processManager: pm2ProcessManager }),
    }
}

export const bootFleet = async (gueterbahnhofDir: string) => {
    const { appsDir, appService } = servicesFor(gueterbahnhofDir)

    // Create the app directory or fail loudly — never prompt (headless hosts).
    await mkdir(appsDir, { recursive: true })

    migrateLegacyAppsJson(gueterbahnhofDir, appsDir)

    await connectProcessManager()
    await appService.reconcileFleet()
}

export const shutdownFleet = async (gueterbahnhofDir: string) => {
    const { appService } = servicesFor(gueterbahnhofDir)

    await appService.stopFleet()
}
