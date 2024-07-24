import type { Router } from "express"
import express from "express"
import { constants, rmSync } from "fs"
import { access } from "fs/promises"
import multer from "multer"
import path from "path"
import AdmZip from "adm-zip"
import { updateAppState } from "./app/appState"
import { getAppConfig } from "./app/appConfigDb"
import { createUiRouter } from "./ui/router"
import { getServerConfig } from "./activeConfig"

function log(...parts: unknown[]) {
    console.log("[Management]", ...parts)
}

export async function createManagementApi(): Promise<Router> {
    const { appDir, apiKey } = getServerConfig()

    if (
        !(await access(appDir, constants.W_OK)
            .then(() => true)
            .catch(() => false))
    ) {
        throw new Error("[Management] Could not create: insufficient rights to appdir.")
    }

    const upload = multer({ limits: {} })

    const router = express.Router()

    router.post("/update/:appname", upload.single("artifact"), async (req, res) => {
        if (apiKey) {
            router.use((req, res) => {
                if (req.headers.authorization !== apiKey) {
                    res.status(403).send("Unauthorized.").end()
                    return
                }
            })
        }

        const appName = req.params.appname

        if (!getAppConfig(appName)) {
            res.status(400).send(`App '${appName}' not found.`).end()
            return
        }

        log(`Updating artifact for ${req.params.appname}.`)
        res.status(200).end()

        const appPath = path.join(appDir, appName)
        rmSync(appPath, { force: true, recursive: true })

        const zip = new AdmZip(req.file.buffer)
        zip.extractAllTo(appPath)

        await updateAppState(appName)
    })

    const uiRouter = await createUiRouter()
    router.use("/ui", uiRouter)

    return router
}
