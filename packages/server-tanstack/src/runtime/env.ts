import { z } from "zod"

const EnvSchema = z.object({
    GUETERBAHNHOF_DIR: z.string(),
})

let cached: z.infer<typeof EnvSchema> | undefined

// Lazy so importing server code (e.g. in tests) never demands env vars.
export const getEnv = () => {
    cached ??= EnvSchema.parse(process.env)
    return cached
}
