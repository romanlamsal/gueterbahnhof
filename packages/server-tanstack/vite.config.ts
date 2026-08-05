import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

const config = defineConfig({
    plugins: [
        devtools(),
        nitro({
            preset: "node-middleware",
            // pm2 is CJS with dynamic requires — inlining it produces a broken
            // ESM chunk (ERR_AMBIGUOUS_MODULE_SYNTAX). Trace the FULL package
            // ('pm2*') into the output: fork mode spawns lib/ProcessContainerFork.js
            // by path, which a static trace misses.
            traceDeps: ["pm2*"],
        }),
        // this is the plugin that enables path aliases
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
    ],
    optimizeDeps: {
        // pm2 and its optional terminal deps are server-only CJS — the dep
        // optimizer must not try to pre-bundle them.
        exclude: ["pty.js", "term.js", "pm2", "@pm2/blessed", "blessed"],
    },
})

export default config
