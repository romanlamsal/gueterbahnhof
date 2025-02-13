import React from "react"
import type { Router } from "express"
import express from "express"
import { fileURLToPath } from "node:url"
import { renderToString } from "react-dom/server"
import { AppForm } from "./components/AppForm"
import { EnvInput } from "./components/EnvInput"
import { deleteAppConfig, getAppConfig } from "../app/appConfigDb"
import { updateAppConfig } from "./updateAppConfig"
import { deleteAppState, listAppState } from "../app/appState"
import { addRoutes } from "./components/Login"
import cookieParser from "cookie-parser"
import { Layout } from "./components/Layout"

export const createUiRouter = async (): Promise<Router> => {
    const router = express.Router()
    router.use(express.urlencoded({ extended: true }))
    router.use(cookieParser())

    addRoutes(router)

    router.use("/assets", express.static(fileURLToPath(new URL("assets", import.meta.url))))

    router.post("/add-env", (_, res) => res.send(renderToString(<EnvInput />)))
    router.delete("/add-env", (_, res) => res.status(200).end())

    router.post("/app", async (req, res) => {
        const formData = req.body as {
            initialName?: string
            name: string
            entry: string
            envname: string | string[]
            envvalue: string | string[]
            intent: "save" | "delete"
        }

        if (!formData.name) {
            return { ok: false, reason: "Name missing." } as { ok: false; reason: string }
        }

        if (formData.intent === "delete") {
            deleteAppState(formData.name)
            deleteAppConfig(formData.name)
            return res.setHeader("HX-Redirect", `/ui`).status(200).end("")
        }

        const updateResult = await updateAppConfig(formData)

        if (!updateResult.ok) {
            return res.send((updateResult as { reason?: string }).reason)
        }

        res.setHeader("HX-Replace-Url", `/ui/app/${formData.name}`)
            .status(200)
            .end("Succesfully saved")
    })

    router.get<"/app/:appname?", { appname?: string }>("/app/:appname?", async (req, res) => {
        const appStates = listAppState()
        const appConfig = getAppConfig(req.params.appname)
        console.debug("AppConfig:", appConfig)
        res.status(200).end(
            renderToString(
                <Layout appStates={appStates} active={req.params.appname}>
                    <AppForm appConfig={appConfig} />
                </Layout>,
            ),
        )
    })

    router.get("", async (_, res) => {
        const appStates = listAppState()
        res.status(200)
            .set({ "Content-Type": "text/html" })
            .end(renderToString(<Layout appStates={appStates} />))
    })

    return router
}
