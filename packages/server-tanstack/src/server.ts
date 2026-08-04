import { existsSync, mkdirSync } from "node:fs"
import { confirm } from "@inquirer/prompts"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { appStateService } from "@/interface-services/app-state-service.ts"
import { getPm } from "@/interface-services/pm-service.ts"
import { getEnv } from "@/runtime/env.ts"
import { getAppService, getAppsDir } from "@/runtime/services.ts"

await getPm().then(async () => {
    console.log("PM2 connected in no-daemon mode.")

    appStateService.init()

    const appsConfigPath = getAppsDir()

    if (!existsSync(getEnv().GUETERBAHNHOF_DIR)) {
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

    await getAppService().startAllApps()
})

export default createServerEntry({
    fetch(request) {
        return handler.fetch(request)
    },
})
