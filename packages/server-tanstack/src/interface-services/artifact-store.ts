import { access, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import AdmZip from "adm-zip"

// Extracted artifacts live at <appsDir>/<appId>/, next to <appId>.json.

export const createArtifactStore = (appsDir: string) => ({
    getAppDir(appId: string) {
        return resolve(join(appsDir, appId))
    },

    async hasArtifact(appId: string) {
        return access(this.getAppDir(appId))
            .then(() => true)
            .catch(() => false)
    },

    async extractArtifact(appId: string, zipFilePath: string) {
        const appDir = this.getAppDir(appId)

        try {
            const zip = new AdmZip(zipFilePath)

            await rm(appDir, { recursive: true, force: true })
            await new Promise<void>((resolveExtract, rejectExtract) => {
                zip.extractAllToAsync(appDir, true, false, error =>
                    error ? rejectExtract(error) : resolveExtract(),
                )
            })
        } catch (error) {
            await rm(appDir, { recursive: true, force: true })
            throw error
        } finally {
            await rm(zipFilePath, { force: true })
        }

        return appDir
    },

    async deleteAppDir(appId: string) {
        await rm(this.getAppDir(appId), { recursive: true, force: true })
    },
})

export type ArtifactStore = ReturnType<typeof createArtifactStore>
