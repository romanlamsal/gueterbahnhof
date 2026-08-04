import { randomUUID } from "node:crypto"
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { AppConfigSchema } from "./app-config-repository.ts"

const LegacyAppsJsonSchema = z.record(
    z.string(),
    z.object({
        name: z.string(),
        entry: z.string().optional(),
        env: z.record(z.string(), z.string()).optional(),
    }),
)

// One-time migration of the legacy single-file config (apps.json, keyed by
// app name) into per-app config files with minted ids. Idempotent: the
// legacy file is renamed to apps.json.migrated afterwards.
export const migrateLegacyAppsJson = (
    gueterbahnhofDir: string,
    appsDir: string,
    generateId: () => string = randomUUID,
): { migrated: number; skipped: number } | undefined => {
    const legacyFile = join(gueterbahnhofDir, "apps.json")

    if (!existsSync(legacyFile)) {
        return undefined
    }

    let legacyApps: z.infer<typeof LegacyAppsJsonSchema>

    try {
        legacyApps = LegacyAppsJsonSchema.parse(JSON.parse(readFileSync(legacyFile, "utf8")))
    } catch (error) {
        console.error("Found a legacy apps.json but could not parse it — leaving it untouched:", error)
        return undefined
    }

    const existingNames = new Set(
        readdirSync(appsDir)
            .filter(file => file.endsWith(".json"))
            .map(file => {
                try {
                    return AppConfigSchema.parse(JSON.parse(readFileSync(join(appsDir, file), "utf8"))).name
                } catch {
                    return undefined
                }
            })
            .filter(name => !!name),
    )

    let migrated = 0
    let skipped = 0

    for (const legacyApp of Object.values(legacyApps)) {
        if (existingNames.has(legacyApp.name)) {
            console.log(`Skipping legacy app '${legacyApp.name}': a config with that name already exists.`)
            skipped++
            continue
        }

        const id = generateId()
        const config = AppConfigSchema.parse({
            id,
            name: legacyApp.name,
            entry: legacyApp.entry,
            env: legacyApp.env ?? {},
        })

        writeFileSync(join(appsDir, `${id}.json`), JSON.stringify(config, null, 2))

        // Legacy artifacts live at <dir>/<name>; the new server expects them
        // at <appsDir>/<id> — move them so migrated apps keep running.
        const legacyArtifactDir = join(gueterbahnhofDir, legacyApp.name)
        if (existsSync(legacyArtifactDir)) {
            renameSync(legacyArtifactDir, join(appsDir, id))
        }

        migrated++
    }

    renameSync(legacyFile, `${legacyFile}.migrated`)
    console.log(`Migrated ${migrated} legacy app config(s) (${skipped} skipped); apps.json -> apps.json.migrated.`)

    return { migrated, skipped }
}
