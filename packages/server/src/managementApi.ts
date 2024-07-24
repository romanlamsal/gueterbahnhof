import { type ServerConfig } from "@gueterbahnhof/common/ServerConfig"
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

function log(...parts: unknown[]) {
    console.log("[Management]", ...parts)
}

export async function createManagementApi({ appDir, apiKey }: ServerConfig): Promise<Router> {
    if (
        !(await access(appDir, constants.W_OK)
            .then(() => true)
            .catch(() => false))
    ) {
        throw new Error("[Management] Could not create: insufficient rights to appdir.")
    }

    const upload = multer({ limits: {} })

    const router = express.Router()

    if (apiKey) {
        router.use((req, res, next) => {
            if (req.headers.authorization !== apiKey) {
                res.status(403).send("Unauthorized.").end()
                return
            }
            next()
        })
    }

    router.post("/update/:appname", upload.single("artifact"), async (req, res) => {
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

        await updateAppState(appDir, appName)
    })

    router.use("/ui", await createUiRouter())

    return router
}
