import { join } from "node:path"
import { createAppService } from "@/app-services/app-service.ts"
import { createDeploymentService } from "@/app-services/deployment-service.ts"
import { createAppConfigRepository } from "@/interface-services/app-config-repository.ts"
import { createArtifactStore } from "@/interface-services/artifact-store.ts"
import { pm2ProcessManager } from "@/interface-services/pm2-process-manager.ts"

// The one place the object graph is wired. Both composition roots call it: the
// server memoises it (runtime/services.ts), the CLI builds one per boot
// (runtime/lifecycle.ts). It deliberately stops below the controllers — the CLI
// bundle imports this file, and pulling controllers in would undo ADR-0004's
// packaging work.
//
// The returned type is inferred on purpose: this is a bag of concrete
// instances, not a port anything has to satisfy.
export const createServices = (gueterbahnhofDir: string) => {
    const appsDir = join(gueterbahnhofDir, "apps")

    const configRepository = createAppConfigRepository(appsDir)
    const artifactStore = createArtifactStore(appsDir)
    const processManager = pm2ProcessManager

    return {
        appsDir,
        configRepository,
        artifactStore,
        processManager,
        appService: createAppService({ configRepository, artifactStore, processManager }),
        deploymentService: createDeploymentService({ configRepository, artifactStore, processManager }),
    }
}

export type Services = ReturnType<typeof createServices>
