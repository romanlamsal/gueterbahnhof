import { mkdir } from "node:fs/promises"
import { migrateLegacyAppsJson } from "@/interface-services/legacy-migration.ts"
import { connectProcessManager } from "@/interface-services/pm2-process-manager.ts"
import { createServices } from "./create-services.ts"

// The fleet's lifecycle belongs to whoever owns the process — the CLI — not to
// the request-serving module (ADR-0003). This module is imported by the CLI
// bundle as well as the server, and that duplication is safe precisely because
// the daemon, not a module instance, holds the fleet's state.

// reservedPorts carries the port the server itself listens on, so port
// assignment can never hand an App the socket Gueterbahnhof is sitting on.
export const bootFleet = async (gueterbahnhofDir: string, reservedPorts: readonly number[] = []) => {
    const { appsDir, appService } = createServices(gueterbahnhofDir)

    // Create the app directory or fail loudly — never prompt (headless hosts).
    await mkdir(appsDir, { recursive: true })

    migrateLegacyAppsJson(gueterbahnhofDir, appsDir)

    await connectProcessManager()
    await appService.reconcileFleet({ reservedPorts })
}

export const shutdownFleet = async (gueterbahnhofDir: string) => {
    const { appService } = createServices(gueterbahnhofDir)

    await appService.stopFleet()
}
