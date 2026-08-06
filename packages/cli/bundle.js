import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import serverPackageJson from "../server-tanstack/package.json" with { type: "json" }
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

const pm2Version = serverPackageJson.dependencies.pm2

if (!pm2Version) {
    console.error("server-tanstack no longer depends on pm2 — update bundle.js.")
    process.exit(1)
}

const serverSrcDir = fileURLToPath(new URL("../server-tanstack/src", import.meta.url))

// cli.js bundles everything it needs — including the fleet lifecycle imported
// from server-tanstack's source, which resolves through the '@/' alias below.
// pm2 is the one exception: it stays external so the client that spawns the
// daemon and the server's own client are the same installed copy (ADR-0003).
await build({
    entryPoints: ["cli.ts"],
    outfile: "dist/cli.js",
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["pm2"],
    tsconfigRaw: {
        compilerOptions: {
            baseUrl: ".",
            paths: {
                "@/*": [`${serverSrcDir}/*`],
                "server-tanstack/src/*": [`${serverSrcDir}/*`],
            },
        },
    },
    banner: {
        js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
})

cpSync(serverOutputDir, join(distFilePath, "server-output"), { recursive: true })

// Nitro traces pm2 into .output/server/node_modules using a symlinked .nf3
// store. npm packs those files but silently drops the symlinks, which is what
// broke 1.0.0 ("Cannot find module 'async/eachLimit'"). Tracing cannot be
// turned off (nitro hardcodes it for production builds), but the copy is safe
// to discard: pm2 is the only bare import in the whole output, and nothing
// reads that directory at runtime. See ticket 01 of the packaging map.
rmSync(join(distFilePath, "server-output/server/node_modules"), { recursive: true, force: true })

writeFileSync(
    join(distFilePath, "package.json"),
    JSON.stringify(
        {
            ...cliPackageJson,
            // pm2 is installed by npm rather than shipped: it is CJS with
            // dynamic requires and spawns its own fork container by path.
            dependencies: { pm2: pm2Version },
            devDependencies: {},
            scripts: {},
        },
        null,
        2,
    ),
)
