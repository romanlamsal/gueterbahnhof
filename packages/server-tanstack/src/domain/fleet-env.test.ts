import { describe, expect, it } from "vitest"
import {
    changedFleetKeys,
    describeFleetSaveRefusal,
    describeMissingFleetKeys,
    isReferenceableFleetKey,
    referencedFleetKeys,
    resolveFleetReferences,
} from "./fleet-env.ts"

const fleet: Record<string, string> = {
    supabase_url: "postgres://host/db",
    bucket: "my-bucket",
    aws_key: "AKIA",
}

const resolve = (env: Record<string, string>, fleetEnv: Record<string, string> = fleet) =>
    resolveFleetReferences(env, fleetEnv)

describe("resolveFleetReferences", () => {
    it("replaces a bare reference that is the whole value", () => {
        expect(resolve({ A: "$fleet.aws_key" }).env).toEqual({ A: "AKIA" })
    })

    it("replaces a braced reference that is the whole value", () => {
        expect(resolve({ A: "${fleet.aws_key}" }).env).toEqual({ A: "AKIA" })
    })

    it("interpolates at the start, the middle and the end of a value", () => {
        expect(
            resolve({
                START: "$fleet.bucket/objects",
                MIDDLE: "s3://$fleet.bucket/objects",
                END: "prefix-$fleet.bucket",
            }).env,
        ).toEqual({
            START: "my-bucket/objects",
            MIDDLE: "s3://my-bucket/objects",
            END: "prefix-my-bucket",
        })
    })

    it("replaces several references in one value", () => {
        expect(resolve({ A: "$fleet.bucket and ${fleet.aws_key} and $fleet.bucket" }).env).toEqual({
            A: "my-bucket and AKIA and my-bucket",
        })
    })

    // The case the whole feature was asked for.
    it("carries a per-App suffix after a shared value", () => {
        expect(resolve({ DATABASE_URL: "$fleet.supabase_url?options=-c search_path=scrumpoker" }).env).toEqual({
            DATABASE_URL: "postgres://host/db?options=-c search_path=scrumpoker",
        })
    })

    it("matches the name greedily, so an underscore suffix becomes part of the name", () => {
        // Deliberate: 'bucket_staging' is one name, not 'bucket' plus '_staging'.
        const { env, missing } = resolve({ A: "$fleet.bucket_staging" })

        expect(env).toEqual({ A: "$fleet.bucket_staging" })
        expect(missing).toEqual(["bucket_staging"])
    })

    it("lets braces rescue that case", () => {
        expect(resolve({ A: "${fleet.bucket}_staging" }).env).toEqual({ A: "my-bucket_staging" })
    })

    it("reports an unknown name and leaves the reference as written", () => {
        const { env, missing } = resolve({ A: "$fleet.supabse_url" })

        // Never half-substituted: the caller refuses to start instead.
        expect(env).toEqual({ A: "$fleet.supabse_url" })
        expect(missing).toEqual(["supabse_url"])
    })

    it("reports every distinct unknown name once", () => {
        const { missing } = resolve({ A: "$fleet.nope", B: "$fleet.nope and $fleet.also_nope" })

        expect(missing.sort()).toEqual(["also_nope", "nope"])
    })

    it("treats a malformed reference as a literal", () => {
        const env = {
            NO_NAME: "$fleet.",
            NO_NAME_BRACED: "${fleet.}",
            WRONG_PREFIX: "$fleetsupabase_url",
            DOLLAR_ONLY: "$",
            SHELL_STYLE: "$HOME/bin",
            OTHER_NAMESPACE: "$app.bucket",
        }

        const result = resolve(env)

        expect(result.env).toEqual(env)
        expect(result.missing).toEqual([])
    })

    it("passes a value with no reference through byte for byte", () => {
        const env = { A: "plain", B: "with spaces and #hash", C: "" }

        expect(resolve(env).env).toEqual(env)
    })

    it("does not resolve a reference inside a Fleet Env value — one pass, no recursion", () => {
        const { env, missing } = resolve({ A: "$fleet.indirect" }, { indirect: "$fleet.aws_key", aws_key: "AKIA" })

        expect(env).toEqual({ A: "$fleet.aws_key" })
        expect(missing).toEqual([])
    })

    it("leaves an empty env alone", () => {
        expect(resolve({})).toEqual({ env: {}, missing: [] })
    })

    it("resolves to an empty string when the Fleet Env value is empty", () => {
        expect(resolveFleetReferences({ A: "x$fleet.blank y" }, { blank: "" }).env).toEqual({ A: "x y" })
    })
})

describe("referencedFleetKeys", () => {
    it("finds every key an Env refers to, in either form", () => {
        const keys = referencedFleetKeys({ A: "$fleet.one", B: "${fleet.two}/x" })

        expect([...keys].sort()).toEqual(["one", "two"])
    })

    it("counts a key referenced twice once", () => {
        expect([...referencedFleetKeys({ A: "$fleet.one", B: "$fleet.one" })]).toEqual(["one"])
    })

    it("finds a reference sitting beside literal text", () => {
        expect([...referencedFleetKeys({ A: "s3://$fleet.bucket/objects" })]).toEqual(["bucket"])
    })

    it("finds nothing in an Env with no references", () => {
        expect(referencedFleetKeys({ A: "plain", B: "$HOME" }).size).toBe(0)
    })
})

describe("isReferenceableFleetKey", () => {
    it("accepts a name the grammar can express", () => {
        expect(isReferenceableFleetKey("supabase_url")).toBe(true)
        expect(isReferenceableFleetKey("AWS_KEY_2")).toBe(true)
    })

    it("rejects a name no App could ever reference", () => {
        for (const key of ["supabase-url", "supabase.url", "supabase url", "", "sü"]) {
            expect(isReferenceableFleetKey(key)).toBe(false)
        }
    })
})

describe("describeMissingFleetKeys", () => {
    it("names the one key that was mistyped", () => {
        expect(describeMissingFleetKeys(["supabse_url"])).toBe("There is no fleet env named 'supabse_url'.")
    })

    it("names all of them when a save breaks several at once", () => {
        expect(describeMissingFleetKeys(["one", "two"])).toBe("No fleet env named 'one', 'two'.")
    })
})

describe("changedFleetKeys", () => {
    it("finds an edited value", () => {
        expect([...changedFleetKeys({ a: "1" }, { a: "2" })]).toEqual(["a"])
    })

    it("finds an added key, which is how a broken App recovers", () => {
        expect([...changedFleetKeys({}, { a: "1" })]).toEqual(["a"])
    })

    it("finds a removed key", () => {
        expect([...changedFleetKeys({ a: "1" }, {})]).toEqual(["a"])
    })

    it("finds nothing when nothing moved", () => {
        expect(changedFleetKeys({ a: "1", b: "2" }, { b: "2", a: "1" }).size).toBe(0)
    })

    it("leaves untouched keys out, so a rotation restarts only what depends on it", () => {
        expect([...changedFleetKeys({ a: "1", b: "1" }, { a: "2", b: "1" })]).toEqual(["a"])
    })
})

describe("describeFleetSaveRefusal", () => {
    it("says why a name is unusable", () => {
        expect(describeFleetSaveRefusal({ code: "unreferenceable-key", keys: ["supabase-url"] })).toBe(
            "No app could refer to 'supabase-url' — names may only use letters, digits and underscores.",
        )
    })

    it("names the apps still using a key", () => {
        expect(
            describeFleetSaveRefusal({
                code: "still-referenced",
                usage: [{ key: "a", apps: ["scrumpoker", "pollen"] }],
            }),
        ).toBe("Cannot remove: 'a' is still used by scrumpoker, pollen.")
    })
})
