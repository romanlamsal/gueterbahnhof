import { ServerConfig } from "@gueterbahnhof/common/ServerConfig"
import fs from "fs"
import https from "https"
import { createSecureContext, SecureContext } from "tls"
import { getApps } from "./apps"

export const createHttpsServer = ({ tlsKey, tlsCert }: ServerConfig) => {
    const isServerSecure = tlsCert && tlsKey

    const servernameToContext: { [key: string]: SecureContext } = getApps().reduce((acc, app) => {
        const isSecure = app.service.tlsKey && app.service.tlsCert

        if (!isSecure) {
            return acc
        }

        const keyContent = isServerSecure && fs.readFileSync(app.service.tlsKey)
        const certContent = isServerSecure && fs.readFileSync(app.service.tlsCert)

        const context: SecureContext = createSecureContext({
            key: keyContent,
            cert: certContent,
        })

        return {
            ...acc,
            [app.service.hostname]: context,
        }
    }, {})

    const serverKeyContent = isServerSecure && fs.readFileSync(tlsKey)
    const serverCertContent = isServerSecure && fs.readFileSync(tlsCert)

    return https.createServer({
        key: serverKeyContent,
        cert: serverCertContent,
        SNICallback: (servername: string, cb: (err: Error | null, ctx?: SecureContext) => void) => {
            const secureContext = servernameToContext[servername]

            console.log("secureContext:", secureContext)

            cb(null, secureContext)
        },
    })
}
