import React from "react"
import type { Router } from "express"
import express from "express"
import { readFileSync } from "fs"
import { fileURLToPath } from "node:url"
import { renderToString } from "react-dom/server"
import { Layout } from "./components/Layout"

const indexHtmlContent = readFileSync(fileURLToPath(new URL("index.html", import.meta.url)), "utf-8")

export const createUiRouter = async (): Promise<Router> => {
    const router = express.Router()

    router.use("/hello", (req, res) => res.end("Hello!"))

    router.use("/assets", express.static(fileURLToPath(new URL("assets", import.meta.url))))

    router.use("*", (req, res) => {
        const indexHtml = indexHtmlContent.replace("<!-- body -->", renderToString(<Layout />))

        res.status(200).set({ "Content-Type": "text/html" }).end(indexHtml)
    })

    return router
}
