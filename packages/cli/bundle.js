import {cpSync, existsSync, mkdirSync, rmSync, writeFileSync} from "node:fs"
import { fileURLToPath } from "node:url"

import cliPackageJson from "./package.json" assert { type: "json" }
import serverPackageJson from "@gueterbahnhof/server/package.json" assert { type: "json" }
import clientPackageJson from "@gueterbahnhof/client/package.json" assert { type: "json" }
import {build} from "esbuild";
import {join} from "node:path";

const distFilePath = fileURLToPath(new URL("dist", import.meta.url))
if (existsSync(distFilePath)) {
    rmSync(distFilePath, { recursive: true, force: true })
}
mkdirSync(distFilePath)

const cliDeps = cliPackageJson.dependencies
const serverDeps = serverPackageJson.dependencies
const clientDeps = clientPackageJson.dependencies

const packageDeps = {...clientDeps, ...serverDeps}

build({
    entryPoints: ["cli.ts"],
    outfile: "dist/cli.js",
    external: Object.keys(packageDeps),
    bundle: true,
    platform: "node",
    format: "esm"
}).then(async () => {
    const serverUiDir = new URL("src/ui/", await import.meta.resolve("@gueterbahnhof/server/package.json"))
    cpSync(new URL("assets", serverUiDir), join(distFilePath, "assets"), { recursive: true })
    cpSync(new URL("index.html", serverUiDir), join(distFilePath, "index.html"))

    writeFileSync(join(distFilePath, "package.json"), JSON.stringify({
        ...cliPackageJson,
        dependencies: {
            ...clientDeps,
            ...serverDeps,
            ...cliPackageJson.dependencies
        },
        devDependencies: {}
    }, null, 2))
})
