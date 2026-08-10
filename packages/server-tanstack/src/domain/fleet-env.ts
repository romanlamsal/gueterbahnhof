// A Fleet Env holds values once for the whole server; an App's Env refers to
// them rather than repeating them. The reference IS the opt-in — an App can
// only receive a value it named — so there is no inheritance list anywhere.
//
// Resolution happens on the way to a process. The App Config on disk always
// keeps the reference, which is why a shared credential never appears in a
// config, a form, or a deploy payload.

// `${fleet.name}` first so a literal may follow a reference immediately;
// `$fleet.name` for the common case, its name matched greedily. A malformed
// reference — `$fleet.` with no name, `${fleet.}` — matches nothing and stays
// literal, which is the same thing it means to a shell.
const REFERENCE = /\$\{fleet\.([A-Za-z0-9_]+)\}|\$fleet\.([A-Za-z0-9_]+)/g

// A key that cannot be referenced is an entry no App could ever use, so the
// name is held to the same shape the grammar can express.
export const isReferenceableFleetKey = (key: string) => /^[A-Za-z0-9_]+$/.test(key)

const namesIn = (value: string) =>
    [...value.matchAll(REFERENCE)].map(match => match[1] ?? match[2]).filter((name): name is string => !!name)

// Every Fleet Env key an Env refers to. One function, three callers: refusing a
// save that names an unknown key, refusing to delete a key still in use, and
// choosing which Apps to recreate when a value changes. They cannot disagree
// because there is only one of them.
export const referencedFleetKeys = (env: Record<string, string>) => {
    const keys = new Set<string>()

    for (const value of Object.values(env)) {
        for (const name of namesIn(value)) {
            keys.add(name)
        }
    }

    return keys
}

const quoted = (names: readonly string[]) => names.map(name => `'${name}'`).join(", ")

// Phrased once, so the App form and the server log say the same thing about
// the same mistake.
export const describeMissingFleetKeys = (missing: readonly string[]) =>
    missing.length === 1 ? `There is no fleet env named ${quoted(missing)}.` : `No fleet env named ${quoted(missing)}.`

// Every key whose meaning changed — added, edited or removed. Apps referencing
// any of these are running on a value that is no longer true, which is why a
// rotation has to restart them rather than wait for the next deploy.
export const changedFleetKeys = (previous: Record<string, string>, next: Record<string, string>) => {
    const changed = new Set<string>()

    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
        if (previous[key] !== next[key]) {
            changed.add(key)
        }
    }

    return changed
}

// Phrased in the domain rather than in the page, for the same reason as
// describeMissingFleetKeys: the page is thin and untested, and a refusal that
// does not say which key or which App is barely a refusal at all.
export const describeFleetSaveRefusal = (
    refusal:
        | { code: "unreferenceable-key"; keys: string[] }
        | { code: "still-referenced"; usage: { key: string; apps: string[] }[] },
) => {
    if (refusal.code === "unreferenceable-key") {
        return `No app could refer to ${quoted(refusal.keys)} — names may only use letters, digits and underscores.`
    }

    const parts = refusal.usage.map(({ key, apps }) => `'${key}' is still used by ${apps.join(", ")}`)

    return `Cannot remove: ${parts.join("; ")}.`
}

export type FleetResolution = { env: Record<string, string>; missing: string[] }

// One pass, deliberately: a Fleet Env value that itself contains a reference
// stays literal, so there is no recursion and no cycle to detect.
export const resolveFleetReferences = (
    env: Record<string, string>,
    fleetEnv: Record<string, string>,
): FleetResolution => {
    const missing = new Set<string>()

    const resolved = Object.fromEntries(
        Object.entries(env).map(([key, value]) => [
            key,
            value.replace(REFERENCE, (whole, braced?: string, bare?: string) => {
                const name = braced ?? bare

                if (name === undefined) {
                    return whole
                }

                const replacement = fleetEnv[name]

                if (replacement === undefined) {
                    missing.add(name)
                    // Left as written; the caller refuses to start rather than
                    // handing a process a half-substituted value.
                    return whole
                }

                return replacement
            }),
        ]),
    )

    return { env: resolved, missing: [...missing] }
}
