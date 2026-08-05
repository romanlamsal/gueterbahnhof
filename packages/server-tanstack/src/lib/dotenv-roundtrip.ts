import { parse } from "dotenv"

// Serialize env pairs to dotenv text and back, honoring npm dotenv's actual
// parsing rules: surrounding quotes are stripped, unquoted '#' starts a
// comment, unquoted values are trimmed, real multiline is allowed inside
// quotes, and '\n' expands only inside double quotes.
//
// In escaped mode values are URI-encoded, which round-trips anything.

const needsQuoting = (value: string) => value === "" || value !== value.trim() || /[#'"`\n\r]/.test(value)

const formatDotenvValue = (value: string) => {
    if (!needsQuoting(value)) {
        return value
    }

    // Pick a quote character the value doesn't contain — dotenv preserves
    // real newlines inside any quotes.
    for (const quote of ["'", '"', "`"] as const) {
        if (!value.includes(quote)) {
            return `${quote}${value}${quote}`
        }
    }

    // Value contains all three quote chars: best effort with double quotes.
    return `"${value.replace(/"/g, '\\"')}"`
}

export const formatEnvs = (envs: [string, string][], escaped: boolean) =>
    envs.map(([key, value]) => `${key}=${escaped ? encodeURIComponent(value) : formatDotenvValue(value)}`).join("\n")

const decodeOrKeep = (value: string) => {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

export const parseEnvs = (text: string, escaped: boolean): [string, string][] =>
    Object.entries(parse(text)).map(([key, value]) => [key, escaped ? decodeOrKeep(value) : value])
