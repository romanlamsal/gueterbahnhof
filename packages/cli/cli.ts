#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import createDeployCommand from "@gueterbahnhof/client/cli"
import { cli } from "cleye"
import { applyJournaldPriorityPrefixes } from "./journald-logging.js"
import createLogsCommand from "./logs-command.js"
import createServerCommand from "./server-command.js"
import { loadServerConfigFile } from "./server-config.js"
import createSystemdCommand from "./systemd-command.js"

// Published, the manifest sits beside cli.js; in the workspace it is one level
// up. Failing loudly beats reporting an undefined version.
function getPackageJson() {
    for (const relativePath of ["../package.json", "./package.json"]) {
        const absoluteUrl = fileURLToPath(
            new URL(
                relativePath,
                import.meta.url.startsWith("file://") ? import.meta.url : `file://${import.meta.url}`,
            ),
        )
        if (existsSync(absoluteUrl)) {
            return absoluteUrl
        }
    }

    throw new Error("Could not find gueterbahnhof's package.json — this is a packaging error.")
}

const version = JSON.parse(readFileSync(getPackageJson()).toString()).version

// --config has to be read straight off argv: the config file fills in whatever
// the environment has not set, and that must happen before any command below
// computes its flag defaults from process.env.
const configPathFromArgv = (argv: string[]) => {
    const flagIndex = argv.indexOf("--config")

    if (flagIndex !== -1 && argv[flagIndex + 1]) {
        return argv[flagIndex + 1]
    }

    return argv.find(arg => arg.startsWith("--config="))?.slice("--config=".length)
}

loadServerConfigFile(configPathFromArgv(process.argv))

// Under systemd, tag errors and warnings so `journalctl -p err` and
// `systemctl status` can tell them apart from ordinary output.
applyJournaldPriorityPrefixes()

cli(
    {
        name: "gueterbahnhof",
        version,
        commands: [createServerCommand(version), createDeployCommand(), createLogsCommand(), createSystemdCommand()],
    },
    argv => {
        // No subcommand given.
        argv.showHelp()
        process.exitCode = 1
    },
)
