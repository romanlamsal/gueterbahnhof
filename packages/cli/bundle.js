import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import cliPackageJson from "./package.json" with { type: "json" }

const distFilePath = fileURLToPath(new URL("dist", import.meta.url))
if (existsSync(distFilePath)) {
    rmSync(distFilePath, { recursive: true, force: true })
}

mkdirSync(distFilePath)

const serverOutputDir = fileURLToPath(new URL("../server-tanstack/.output", import.meta.url))

if (!existsSync(serverOutputDir)) {
    console.error("server-tanstack/.output not found — build server-tanstack first (turbo does this for you).")
    process.exit(1)
}

// Everything is bundled: cli.js is self-contained, the nitro server bundle
// ships alongside it, and the published package has zero dependencies.
await build({
    entryPoints: ["cli.ts"],
    outfile: "dist/cli.js",
    bundle: true,
    platform: "node",
    format: "esm",
    banner: {
        js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
})

cpSync(serverOutputDir, join(distFilePath, "server-output"), { recursive: true })

writeFileSync(
    join(distFilePath, "package.json"),
    JSON.stringify(
        {
            ...cliPackageJson,
            dependencies: {},
            devDependencies: {},
            scripts: {},
        },
        null,
        2,
    ),
)
