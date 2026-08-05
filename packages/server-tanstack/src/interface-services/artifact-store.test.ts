import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import AdmZip from "adm-zip"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { type ArtifactStore, createArtifactStore } from "./artifact-store.ts"

const writeZip = (dir: string, files: Record<string, string>) => {
    const zip = new AdmZip()
    for (const [name, content] of Object.entries(files)) {
        zip.addFile(name, Buffer.from(content))
    }
    const zipPath = join(dir, "artifact.zip")
    writeFileSync(zipPath, zip.toBuffer())
    return zipPath
}

describe("artifactStore", () => {
    let appsDir: string
    let scratchDir: string
    let store: ArtifactStore

    beforeEach(() => {
        appsDir = mkdtempSync(join(tmpdir(), "gbhf-apps-"))
        scratchDir = mkdtempSync(join(tmpdir(), "gbhf-zips-"))
        store = createArtifactStore(appsDir)
    })

    afterEach(() => {
        rmSync(appsDir, { recursive: true, force: true })
        rmSync(scratchDir, { recursive: true, force: true })
    })

    it("extracts an artifact into the app directory", async () => {
        const zipPath = writeZip(scratchDir, { "index.js": "console.log('hi')", "sub/file.txt": "nested" })

        await store.extractArtifact("app-1", zipPath)

        const appDir = store.getAppDir("app-1")
        expect(readFileSync(join(appDir, "index.js"), "utf8")).toBe("console.log('hi')")
        expect(readFileSync(join(appDir, "sub/file.txt"), "utf8")).toBe("nested")
    })

    it("replaces a previous artifact completely", async () => {
        mkdirSync(store.getAppDir("app-1"), { recursive: true })
        writeFileSync(join(store.getAppDir("app-1"), "stale.txt"), "old")

        const zipPath = writeZip(scratchDir, { "index.js": "new" })
        await store.extractArtifact("app-1", zipPath)

        expect(existsSync(join(store.getAppDir("app-1"), "stale.txt"))).toBe(false)
        expect(readFileSync(join(store.getAppDir("app-1"), "index.js"), "utf8")).toBe("new")
    })

    it("removes the uploaded zip after extraction", async () => {
        const zipPath = writeZip(scratchDir, { "index.js": "x" })

        await store.extractArtifact("app-1", zipPath)

        expect(existsSync(zipPath)).toBe(false)
    })

    it("throws on a corrupt zip and leaves no half-extracted app dir", async () => {
        const zipPath = join(scratchDir, "corrupt.zip")
        writeFileSync(zipPath, "this is not a zip")

        await expect(store.extractArtifact("app-1", zipPath)).rejects.toThrow()

        expect(existsSync(store.getAppDir("app-1"))).toBe(false)
    })

    it("knows whether an artifact is present", async () => {
        expect(await store.hasArtifact("app-1")).toBe(false)

        const zipPath = writeZip(scratchDir, { "index.js": "x" })
        await store.extractArtifact("app-1", zipPath)

        expect(await store.hasArtifact("app-1")).toBe(true)
    })

    it("deletes the app directory", async () => {
        const zipPath = writeZip(scratchDir, { "index.js": "x" })
        await store.extractArtifact("app-1", zipPath)

        await store.deleteAppDir("app-1")

        expect(await store.hasArtifact("app-1")).toBe(false)
        expect(existsSync(store.getAppDir("app-1"))).toBe(false)
    })
})
