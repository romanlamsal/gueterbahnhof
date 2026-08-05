import { join } from "node:path"
import { createAppService } from "@/app-services/app-service.ts"
import { createAuthService } from "@/app-services/auth-service.ts"
import { createDeploymentService } from "@/app-services/deployment-service.ts"
import { createAppsController } from "@/controllers/apps-controller.ts"
import { createAuthController } from "@/controllers/auth-controller.ts"
import { createDeployController } from "@/controllers/deploy-controller.ts"
import { createEventsController } from "@/controllers/events-controller.ts"
import { createAppConfigRepository } from "@/interface-services/app-config-repository.ts"
import { appStateService } from "@/interface-services/app-state-service.ts"
import { createArtifactStore } from "@/interface-services/artifact-store.ts"
import { pm2ProcessManager } from "@/interface-services/pm2-process-manager.ts"
import { createSessionSigner } from "@/interface-services/session-signer.ts"
import { getEnv } from "./env.ts"

// Composition root: controllers get their app services from here, and only
// from here — tests build their own instances with fakes instead.

let appConfigRepository: ReturnType<typeof createAppConfigRepository> | undefined
let appService: ReturnType<typeof createAppService> | undefined
let artifactStore: ReturnType<typeof createArtifactStore> | undefined
let deploymentService: ReturnType<typeof createDeploymentService> | undefined
let deployController: ReturnType<typeof createDeployController> | undefined

export const getAppsDir = () => join(getEnv().GUETERBAHNHOF_DIR, "apps")

export const getAppConfigRepository = () => {
    appConfigRepository ??= createAppConfigRepository(getAppsDir())
    return appConfigRepository
}

export const getArtifactStore = () => {
    artifactStore ??= createArtifactStore(getAppsDir())
    return artifactStore
}

export const getAppService = () => {
    appService ??= createAppService({
        configRepository: getAppConfigRepository(),
        processManager: pm2ProcessManager,
        artifactStore: getArtifactStore(),
    })
    return appService
}

export const getDeploymentService = () => {
    deploymentService ??= createDeploymentService({
        configRepository: getAppConfigRepository(),
        artifactStore: getArtifactStore(),
        processManager: pm2ProcessManager,
    })
    return deploymentService
}

export const getDeployController = () => {
    deployController ??= createDeployController({ deploymentService: getDeploymentService() })
    return deployController
}

let authService: ReturnType<typeof createAuthService> | undefined
let authController: ReturnType<typeof createAuthController> | undefined
let appsController: ReturnType<typeof createAppsController> | undefined
let eventsController: ReturnType<typeof createEventsController> | undefined

export const getAppsController = () => {
    appsController ??= createAppsController({ appService: getAppService() })
    return appsController
}

export const getEventsController = () => {
    eventsController ??= createEventsController({ appStateEvents: appStateService })
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
