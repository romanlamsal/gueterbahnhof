import { constants } from "node:fs"
import { chmod, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parse } from "dotenv"
import { formatEnvs } from "@/domain/env-format.ts"

// The Fleet Env port, written from what callers use. Where the file lives and
// what format it is in are the implementation's business, so neither is on here.
//
// It is read on demand and NEVER placed into Gueterbahnhof's own environment:
// pm2 hands an app the server's process.env, which is the route 1.4.1 closed,
// and putting Fleet Env there would give every App every value regardless of
// what it referenced.
export type FleetEnvRepository = {
    readFleetEnv(): Promise<Record<string, string>>
    writeFleetEnv(values: Record<string, string>): Promise<void>
}

const OWNER_ONLY = constants.S_IRUSR | constants.S_IWUSR

export const FLEET_ENV_FILE_NAME = "fleet.env"

export const createFleetEnvRepository = (gueterbahnhofDir: string): FleetEnvRepository => {
    const filePath = join(gueterbahnhofDir, FLEET_ENV_FILE_NAME)

    return {
        async readFleetEnv() {
            const contents = await readFile(filePath, "utf8").catch(() => undefined)

            // No file is an empty Fleet Env, not an error: the feature is inert
            // until somebody uses it.
            if (contents === undefined) {
                return {}
            }

            // It holds shared credentials, so warn the way the server config
            // file already does when it is readable by anyone else.
            const mode = (await stat(filePath).catch(() => undefined))?.mode

            if (mode !== undefined && (mode & ~OWNER_ONLY & 0o777) !== 0) {
                console.warn(
                    `Warning: ${filePath} holds fleet-wide values but is readable by others — run: chmod 600 ${filePath}`,
                )
            }

            return parse(contents)
        },

        async writeFleetEnv(values) {
            // Owner-only from the moment it exists, rather than written wide and
            // tightened afterwards — the gap is exactly when it holds secrets.
            await writeFile(filePath, `${formatEnvs(Object.entries(values), false)}\n`, { mode: OWNER_ONLY })
            // writeFile only applies the mode when creating, so an existing file
            // keeps whatever it had until told otherwise.
            await chmod(filePath, OWNER_ONLY)
        },
    }
}
