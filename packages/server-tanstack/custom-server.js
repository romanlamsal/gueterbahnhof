import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { confirm } from "@inquirer/prompts"
import express from "express"
import { toNodeHandler } from "srvx/node"
import { $env } from "@/lib/$env.js"
import { appService } from "@/lib/app-service.js"
import { getPm } from "@/lib/pm-service.js"

const DEVELOPMENT = process.env.NODE_ENV !== "production"
const PORT = Number.parseInt(process.env.PORT || "3000")

const app = express()

if (DEVELOPMENT) {
    const viteDevServer = await import("vite").then(vite =>
        vite.createServer({
            server: { middlewareMode: true },
        }),
    )
    app.use(viteDevServer.middlewares)
    app.use(async (req, res, next) => {
        try {
            const { default: serverEntry } = await viteDevServer.ssrLoadModule("./src/server.ts")
            const handler = toNodeHandler(serverEntry.fetch)
            await handler(req, res)
        } catch (error) {
            if (typeof error === "object" && error instanceof Error) {
                viteDevServer.ssrFixStacktrace(error)
            }
            next(error)
        }
    })
} else {
    console.log("Starting PRODUCTION server.")
    const { middleware } = await import("./.output/server/index.mjs")
    app.use(express.static(".output/public"))
    app.use(async (req, res, next) => {
        try {
            await middleware(req, res)
        } catch (error) {
            next(error)
        }
    })
}

await getPm().then(async () => {
    console.log("PM2 connected in no-daemon mode.")

    const appsConfigPath = join($env.GUETERBAHNHOF_DIR, "apps")

    if (!existsSync($env.GUETERBAHNHOF_DIR)) {
        const shouldCreate = await confirm({
            message: "GUETERBAHNHOF_DIR does not exist. Create?",
            default: false,
        }).catch(() => {
            return false
        })

        if (!shouldCreate) {
            process.exit(1)
        }

        mkdirSync(appsConfigPath, { recursive: true })
    }

    if (!existsSync(appsConfigPath)) {
        mkdirSync(appsConfigPath)
    }

    await appService.startAllApps()

    let wipePromise = undefined
    for (const signal of ["SIGTERM", "SIGINT"]) {
        process.on(signal, async () => {
            console.log("SIGNAL:", signal)

            if (!wipePromise) {
                wipePromise = appService.wipeAllApps()
            }

            await wipePromise
        })
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})
