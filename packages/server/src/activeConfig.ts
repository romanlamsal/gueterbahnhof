import { ServerConfig } from "@gueterbahnhof/common/ServerConfig"

let config: ServerConfig

export const setServerConfig = (serverConfig: ServerConfig) => {
    config = serverConfig
}

export const getServerConfig = () => ({ ...config })
