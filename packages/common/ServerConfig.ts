export type ServerConfig = {
    port: number | string
    appDir: string
    hostname?: string
    apiKey?: string
    tlsCert?: string
    tlsKey?: string
}
