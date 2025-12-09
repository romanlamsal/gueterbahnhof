import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { confirm } from "@inquirer/prompts"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { $env } from "@/lib/$env.ts"
import { appService } from "@/lib/app-service.ts"
import { appStateService } from "@/lib/app-state-service.ts"
import { getPm } from "@/lib/pm-service.ts"

await getPm().then(async () => {
    console.log("PM2 connected in no-daemon mode.")

    appStateService.init()

    const appsConfigPath = join($env.GUETERBAHNHOF_DIR, "apps")

    if (!existsSync($env.GUETERBAHNHOF_DIR)) {
        const shouldCreate = await confirm({
            message: "GUETERBAHNHOF_DIR does not exist. Create?",
            default: false,
        }).catch(() => {
            return false
        })

        if (!shouldCreate) {
            process.exit(1)
        }

        mkdirSync(appsConfigPath, { recursive: true })
    }

    if (!existsSync(appsConfigPath)) {
        mkdirSync(appsConfigPath)
    }

    await appService.startAllApps()
})

export default createServerEntry({
    fetch(request) {
        return handler.fetch(request)
    },
})
