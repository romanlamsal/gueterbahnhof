import { type ServerConfig } from "@gueterbahnhof/common/ServerConfig"
import express from "express"
import { constants, rmSync, writeFileSync } from "fs"
import { access } from "fs/promises"
import multer from "multer"
import path from "path"
import { getApp, toAppPath } from "./apps"
import AdmZip from "adm-zip"
import { addAppRoute } from "./appRouter"

function log(...parts: unknown[]) {
    console.log("[Management]", ...parts)
}

export async function createManagementApi({ appDir, apiKey }: ServerConfig) {
    if (
        !(await access(appDir, constants.W_OK)
            .then(() => true)
            .catch(() => false))
    ) {
        throw new Error("[Management] Could not create: insufficient rights to appdir.")
    }

    const uploadDest = path.join(appDir, "uploads")
    const upload = multer({ limits: { fieldSize: undefined, fileSize: undefined } })

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
        const app = getApp(appName)

        if (!app) {
            res.status(400).send(`App '${appName}' not found.`).end()
            return
        }

        log(`Updating artifact for ${req.params.appname}.`)
        res.status(200).end()
        const zipFileLocation = path.join(uploadDest, app.id + ".zip")
        writeFileSync(zipFileLocation, req.file.buffer)
        const appPath = toAppPath(app.id)
        rmSync(appPath, { force: true, recursive: true })
        const zip = new AdmZip(zipFileLocation)
        zip.extractAllTo(appPath)

        await addAppRoute(app)
    })

    return router
}
