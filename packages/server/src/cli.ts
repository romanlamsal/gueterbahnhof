#!/bin/node

import { ServerConfig } from "@gueterbahnhof/common/ServerConfig"
import { createCommand } from "commander"
import { createMainApp } from "./createMainApp"

export default createCommand("server")
    .option("-p, --port <number>", "set server port")
    .option("--hostname <string>", "set server hostname to use")
    .option("--app-dir <string>", "set app directory to use")
    .option("--api-key <string>", "api key for the management api")
    .option("--tls-cert <string>", "tls certificate location")
    .option("--tls-key <string>", "tls key location")
    .action(async (options: ServerConfig) => {
        await createMainApp(options).then(({ start }) => {
            start()
        })
    })
