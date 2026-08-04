import type { AppService } from "@/app-services/app-service.ts"

export const createAppsController = ({ appService }: { appService: Pick<AppService, "listApps"> }) => ({
    async getApps(): Promise<Response> {
        const apps = await appService.listApps()

        return Response.json(
            apps.map(({ config, state }) => ({
                id: config.id,
                name: config.name,
                state,
            })),
        )
    },
})

export type AppsController = ReturnType<typeof createAppsController>
