import { randomUUID } from "node:crypto"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { AppConfigSchema } from "@/lib/app-config-repository.ts"
import { appService } from "@/lib/app-service.ts"

export const loadAppsFunc = createServerFn({ method: "GET" }).handler(() => appService.listApps())

export const createAppFunc = createServerFn({ method: "POST" }).handler(() =>
    appService.createService(randomUUID()),
)

export const updateAppFunc = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            appId: z.string(),
            config: AppConfigSchema.partial(),
        }),
    )
    .handler(({ data: { appId, config } }) => {
        return appService.updateAppConfig(appId, config)
    })
