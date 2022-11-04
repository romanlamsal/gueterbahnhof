import { StartOptions } from "pm2"

// 'entry' must be a relative path in the app's artifact
type ServiceConfig = Omit<StartOptions, "name" | "script"> & { entry: string }

export type Service = {
    hostname: string
    target: string
    config: ServiceConfig
    tlsCert?: string
    tlsKey?: string
}

export type App = {
    id: string
    service: Service
    name: string
    pending: boolean
}
