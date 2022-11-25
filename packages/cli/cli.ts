#!/usr/bin/env node

import { program } from "commander"
import serverCommand from "@gueterbahnhof/server"
import clientCommand from "@gueterbahnhof/client"
import { existsSync, readFileSync } from "fs"
import { fileURLToPath } from "url"

function getPackageJson() {
    for (const relativePath of ["../package.json", "./package.json"]) {
        const absoluteUrl = fileURLToPath(
            new URL(relativePath, import.meta.url.startsWith("file://") ? import.meta.url : `file://${import.meta.url}`)
        )
        if (existsSync(absoluteUrl)) {
            return absoluteUrl
        }
    }

    return
}

const version = JSON.parse(readFileSync(getPackageJson()).toString()).version

program.version(version).addCommand(serverCommand(version)).addCommand(clientCommand)

program.parse(process.argv)
