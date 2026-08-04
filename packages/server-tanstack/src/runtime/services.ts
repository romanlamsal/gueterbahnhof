import { join } from "node:path"
import { createAppService } from "@/app-services/app-service.ts"
import { createDeploymentService } from "@/app-services/deployment-service.ts"
import { createDeployController } from "@/controllers/deploy-controller.ts"
import { createAppConfigRepository } from "@/interface-services/app-config-repository.ts"
import { createArtifactStore } from "@/interface-services/artifact-store.ts"
import { pm2Service } from "@/interface-services/pm-service.ts"
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

export const getAppService = () => {
    appService ??= createAppService({
        configRepository: getAppConfigRepository(),
        processManager: pm2Service,
    })
    return appService
}

export const getArtifactStore = () => {
    artifactStore ??= createArtifactStore(getAppsDir())
    return artifactStore
}

export const getDeploymentService = () => {
    deploymentService ??= createDeploymentService({
        configRepository: getAppConfigRepository(),
        artifactStore: getArtifactStore(),
        processManager: pm2Service,
    })
    return deploymentService
}

export const getDeployController = () => {
    deployController ??= createDeployController({ deploymentService: getDeploymentService() })
    return deployController
}
