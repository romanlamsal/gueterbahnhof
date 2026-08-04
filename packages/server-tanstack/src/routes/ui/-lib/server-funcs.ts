import { randomUUID } from "node:crypto"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { AppConfigSchema } from "@/interface-services/app-config-repository.ts"
import { getAppService } from "@/runtime/services.ts"

export const loadAppsFunc = createServerFn({ method: "GET" }).handler(() => getAppService().listApps())

export const createAppFunc = createServerFn({ method: "POST" }).handler(() => getAppService().createApp(randomUUID()))

export const updateAppFunc = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            appId: z.string(),
            config: AppConfigSchema.partial(),
        }),
    )
    .handler(({ data: { appId, config } }) => {
        return getAppService().updateAppConfig(appId, config)
    })
