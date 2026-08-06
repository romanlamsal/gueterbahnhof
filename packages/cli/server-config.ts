import { existsSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse } from "dotenv"

export const DEFAULT_CONFIG_PATH = join(homedir(), ".gueterbahnhof")

// Server Config precedence is flag > environment > file. Since every flag
// already defaults to its GUETERBAHNHOF_* variable, the file only has to fill
// in what is not set yet and the precedence falls out on its own.
export const loadServerConfigFile = (configPath: string = DEFAULT_CONFIG_PATH) => {
    if (!existsSync(configPath)) {
        return { loaded: false, applied: [] as string[] }
    }

    const contents = readFileSync(configPath, "utf8")
    const values = parse(contents)

    const holdsSecret = Object.keys(values).some(key => /KEY|TOKEN|SECRET|PASS/i.test(key))
    const mode = statSync(configPath).mode & 0o077

    if (holdsSecret && mode !== 0) {
        console.warn(`Warning: ${configPath} holds a secret but is readable by others — run: chmod 600 ${configPath}`)
    }

    const applied: string[] = []

    for (const [key, value] of Object.entries(values)) {
        if (process.env[key] === undefined) {
            process.env[key] = value
            applied.push(key)
        }
    }

    return { loaded: true, applied }
}
