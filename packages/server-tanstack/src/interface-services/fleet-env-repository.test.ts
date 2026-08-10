import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createFleetEnvRepository, FLEET_ENV_FILE_NAME } from "./fleet-env-repository.ts"

const dirs: string[] = []

afterEach(async () => {
    await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
    vi.restoreAllMocks()
})

const withDir = async (contents?: string, mode = 0o600) => {
    const dir = await mkdtemp(join(tmpdir(), "gbh-fleet-env-"))
    dirs.push(dir)

    if (contents !== undefined) {
        const filePath = join(dir, FLEET_ENV_FILE_NAME)
        await writeFile(filePath, contents)
        await chmod(filePath, mode)
    }

    return createFleetEnvRepository(dir)
}

describe("fleetEnvRepository.readFleetEnv", () => {
    it("reads the values", async () => {
        const repository = await withDir("supabase_url=postgres://host/db\naws_key=AKIA\n")

        await expect(repository.readFleetEnv()).resolves.toEqual({
            supabase_url: "postgres://host/db",
            aws_key: "AKIA",
        })
    })

    // The feature has to be inert until somebody uses it.
    it("treats a missing file as an empty Fleet Env rather than an error", async () => {
        const repository = await withDir()

        await expect(repository.readFleetEnv()).resolves.toEqual({})
    })

    it("honours dotenv semantics, so a value can hold what a connection string holds", async () => {
        const repository = await withDir('url="postgres://u:p@host/db?a=1#frag"\nempty=\n')

        await expect(repository.readFleetEnv()).resolves.toEqual({
            url: "postgres://u:p@host/db?a=1#frag",
            empty: "",
        })
    })

    it("keeps a reference-shaped value literal — resolution is not the repository's job", async () => {
        const repository = await withDir("indirect=$fleet.other\n")

        await expect(repository.readFleetEnv()).resolves.toEqual({ indirect: "$fleet.other" })
    })

    it("says nothing about permissions when the file is owner-only", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
        const repository = await withDir("a=1\n", 0o600)

        await repository.readFleetEnv()

        expect(warn).not.toHaveBeenCalled()
    })

    it("warns when the file holding shared values is readable by others", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
        const repository = await withDir("a=1\n", 0o644)

        await repository.readFleetEnv()

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("chmod 600"))
    })
})

describe("fleetEnvRepository.writeFleetEnv", () => {
    it("writes values that read back identically", async () => {
        const repository = await withDir("")

        await repository.writeFleetEnv({ supabase_url: "postgres://u:p@host/db?a=1#frag", empty: "" })

        await expect(repository.readFleetEnv()).resolves.toEqual({
            supabase_url: "postgres://u:p@host/db?a=1#frag",
            empty: "",
        })
    })

    it("keeps a reference-shaped value literal on the way out and back", async () => {
        const repository = await withDir("")

        await repository.writeFleetEnv({ a: "$fleet.other" })

        await expect(repository.readFleetEnv()).resolves.toEqual({ a: "$fleet.other" })
    })

    it("creates the file owner-only, so it is never briefly world-readable", async () => {
        const dir = await mkdtemp(join(tmpdir(), "gbh-fleet-env-"))
        dirs.push(dir)

        await createFleetEnvRepository(dir).writeFleetEnv({ a: "1" })

        const mode = (await stat(join(dir, FLEET_ENV_FILE_NAME))).mode & 0o777
        expect(mode).toBe(0o600)
    })

    it("tightens an existing file that was too open", async () => {
        const dir = await mkdtemp(join(tmpdir(), "gbh-fleet-env-"))
        dirs.push(dir)
        const filePath = join(dir, FLEET_ENV_FILE_NAME)
        await writeFile(filePath, "a=1\n")
        await chmod(filePath, 0o644)

        await createFleetEnvRepository(dir).writeFleetEnv({ a: "2" })

        expect((await stat(filePath)).mode & 0o777).toBe(0o600)
    })

    it("removes a key that is absent from the new set", async () => {
        const repository = await withDir("a=1\nb=2\n")

        await repository.writeFleetEnv({ a: "1" })

        await expect(repository.readFleetEnv()).resolves.toEqual({ a: "1" })
    })
})
