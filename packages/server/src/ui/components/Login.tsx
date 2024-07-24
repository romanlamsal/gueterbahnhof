import React from "react"
import type { Router } from "express"
import { renderToString } from "react-dom/server"
import { getServerConfig } from "../../activeConfig"
import { Root } from "./Root"

const cookieName = "gueterbahnhof.auth-token"

export const addRoutes = (router: Router) => {
    if (getServerConfig().apiKey) {
        router.use((req, res, next) => {
            const authCookie = req.cookies?.[cookieName]

            if (req.path !== "/login" && !authCookie) {
                return res.redirect(`/ui/login?redirect_uri=/ui${req.path}`)
            }

            next()
        })
    }

    router.get("/login", (req, res) => {
        res.send(renderToString(<Login redirectUri={(req.query as { redirect_uri?: string }).redirect_uri} />))
    })

    router.post("/login", (req, res) => {
        const { apiKey } = getServerConfig()

        if (apiKey === (req.body as { apikey: string; redirectUri?: string }).apikey) {
            res.cookie(cookieName, req.body.apikey, { httpOnly: true, path: "/", sameSite: "lax" })
            if (req.body.redirectUri) {
                res.setHeader("HX-Redirect", req.body.redirectUri)
            }
            return res.end()
        }
        return res.status(200).end("Failed.")
    })
}

export const Login = ({ redirectUri }: { redirectUri?: string }) => {
    return (
        <Root>
            <form hx-post={"/ui/login"} hx-target={"#error"}>
                <input type={"hidden"} name={"redirectUri"} defaultValue={redirectUri} />
                <label>
                    <div>ApiKey</div>
                    <input className={"rounded-xl border"} name={"apikey"} />
                </label>
                <div className={"text-red-500"} id={"error"}></div>
                <button>login</button>
            </form>
        </Root>
    )
}
