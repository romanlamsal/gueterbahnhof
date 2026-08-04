import { existsSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"
import AdmZip from "adm-zip"

// Extracted artifacts live at <appsDir>/<appId>/, next to <appId>.json.

export const createArtifactStore = (appsDir: string) => ({
    getAppDir(appId: string) {
        return resolve(join(appsDir, appId))
    },

    hasArtifact(appId: string) {
        return existsSync(this.getAppDir(appId))
    },

    async extractArtifact(appId: string, zipFilePath: string) {
        const appDir = this.getAppDir(appId)

        try {
            const zip = new AdmZip(zipFilePath)

            rmSync(appDir, { recursive: true, force: true })
            zip.extractAllTo(appDir)
        } catch (error) {
            rmSync(appDir, { recursive: true, force: true })
            throw error
        } finally {
            rmSync(zipFilePath, { force: true })
        }

        return appDir
    },

    async deleteAppDir(appId: string) {
        rmSync(this.getAppDir(appId), { recursive: true, force: true })
    },
})

export type ArtifactStore = ReturnType<typeof createArtifactStore>
