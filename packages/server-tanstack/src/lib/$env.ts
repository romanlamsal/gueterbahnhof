import { z } from "zod"

export const $env = z
    .object({
        GUETERBAHNHOF_DIR: z.string(),
    })
    .parse(process.env)
