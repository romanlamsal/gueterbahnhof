import { createAuthService } from "@/app-services/auth-service.ts"
import { createAppsController } from "@/controllers/apps-controller.ts"
import { createAuthController } from "@/controllers/auth-controller.ts"
import { createDeployController } from "@/controllers/deploy-controller.ts"
import { createEventsController } from "@/controllers/events-controller.ts"
import { type AppStateBus, createAppStateBus } from "@/interface-services/app-state-service.ts"
import { pm2ProcessEvents } from "@/interface-services/pm2-process-events.ts"
import { createSessionSigner } from "@/interface-services/session-signer.ts"
import { createServices, type Services } from "./create-services.ts"
import { getEnv } from "./env.ts"

// The server's composition root: one memoised graph from createServices, plus
// the controllers, which only this side needs. Routes get their controllers
// from here and only from here; tests build their own with fakes instead.

let services: Services | undefined

const getServices = () => {
    services ??= createServices(getEnv().GUETERBAHNHOF_DIR)
    return services
}

export const getAppsDir = () => getServices().appsDir
export const getAppConfigRepository = () => getServices().configRepository
export const getArtifactStore = () => getServices().artifactStore
export const getAppService = () => getServices().appService
export const getDeploymentService = () => getServices().deploymentService

let deployController: ReturnType<typeof createDeployController> | undefined
let authService: ReturnType<typeof createAuthService> | undefined
let authController: ReturnType<typeof createAuthController> | undefined
let appsController: ReturnType<typeof createAppsController> | undefined
let eventsController: ReturnType<typeof createEventsController> | undefined

export const getDeployController = () => {
    deployController ??= createDeployController({ deploymentService: getDeploymentService() })
    return deployController
}

export const getAppsController = () => {
    appsController ??= createAppsController({ appService: getAppService() })
    return appsController
}

let appStateBus: AppStateBus | undefined

export const getAppStateBus = () => {
    appStateBus ??= createAppStateBus({ processEvents: pm2ProcessEvents })
    return appStateBus
}

export const getEventsController = () => {
    eventsController ??= createEventsController({ appStateEvents: getAppStateBus() })
    return eventsController
}

export const getAuthService = () => {
    authService ??= createAuthService({
        apiKey: getEnv().GUETERBAHNHOF_API_KEY,
        sessionSigner: createSessionSigner(getEnv().GUETERBAHNHOF_API_KEY ?? "gueterbahnhof-open"),
    })
    return authService
}

export const getAuthController = () => {
    authController ??= createAuthController({ authService: getAuthService() })
    return authController
}
