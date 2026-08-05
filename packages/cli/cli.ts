#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import deployCommand from "@gueterbahnhof/client/cli"
import { cli } from "cleye"
import createServerCommand from "./server-command.js"

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

cli(
    {
        name: "gueterbahnhof",
        version,
        commands: [createServerCommand(version), deployCommand],
    },
    argv => {
        // No subcommand given.
        argv.showHelp()
        process.exitCode = 1
    },
)
