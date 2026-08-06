import { access, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import AdmZip from "adm-zip"

// Extracted Artifacts live at <appsDir>/<appId>/, next to <appId>.json.
export type ArtifactStore = {
    /** Where this App's Artifact is unpacked — also the process's cwd. */
    getAppDir(appId: string): string
    hasArtifact(appId: string): Promise<boolean>
    /** Replaces the App Directory with the zip's contents; removes the upload. */
    extractArtifact(appId: string, zipFilePath: string): Promise<string>
    deleteAppDir(appId: string): Promise<void>
}

export const createArtifactStore = (appsDir: string): ArtifactStore => {
    const appDirOf = (appId: string) => resolve(join(appsDir, appId))

    return {
        getAppDir: appDirOf,

        async hasArtifact(appId) {
            return access(appDirOf(appId))
                .then(() => true)
                .catch(() => false)
        },

        async extractArtifact(appId, zipFilePath) {
            const appDir = appDirOf(appId)

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

        async deleteAppDir(appId) {
            await rm(appDirOf(appId), { recursive: true, force: true })
        },
    }
}
