import { randomUUID } from "node:crypto"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { AppConfigSchema } from "@/interface-services/app-config-repository.ts"
import { assertUiSession } from "@/controllers/ui-session.ts"
import { getAppService } from "@/runtime/services.ts"

export const loadAppsFunc = createServerFn({ method: "GET" }).handler(() => {
    assertUiSession()
    return getAppService().listApps()
})

export const createAppFunc = createServerFn({ method: "POST" }).handler(() => {
    assertUiSession()
    return getAppService().createApp(randomUUID())
})

export const updateAppFunc = createServerFn({ method: "POST" })
    .inputValidator(
        z.object({
            appId: z.string(),
            config: AppConfigSchema.partial(),
        }),
    )
    .handler(({ data: { appId, config } }) => {
        assertUiSession()
        return getAppService().updateAppConfig(appId, config)
    })

export const deleteAppFunc = createServerFn({ method: "POST" })
    .inputValidator(z.object({ appId: z.string() }))
    .handler(({ data: { appId } }) => {
        assertUiSession()
        return getAppService().deleteApp(appId)
    })
