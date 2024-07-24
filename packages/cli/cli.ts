import { program } from "commander"
import createServerCommand from "@gueterbahnhof/server/cli"
import clientCommand from "@gueterbahnhof/client/cli"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

function getPackageJson() {
    for (const relativePath of ["../package.json", "./package.json"]) {
        const absoluteUrl = fileURLToPath(
            new URL(relativePath, import.meta.url.startsWith("file://") ? import.meta.url : `file://${import.meta.url}`),
        )
        if (existsSync(absoluteUrl)) {
            return absoluteUrl
        }
    }
}

const version = JSON.parse(readFileSync(getPackageJson()).toString()).version

program.version(version).addCommand(createServerCommand(version)).addCommand(clientCommand)

program.parse(process.argv)
