import { randomUUID } from "node:crypto"
import { createWriteStream } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Writable } from "node:stream"
import Busboy from "@fastify/busboy"

// Streams the 'artifact' file of a multipart upload to a temp file so fat
// bundles never sit in memory. Resolves with the temp file path.
export const saveArtifactUpload = (request: Request): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
        const contentType = request.headers.get("content-type") ?? ""

        if (!contentType.startsWith("multipart/form-data") || !request.body) {
            return resolve(undefined)
        }

        const busboy = new Busboy({ headers: { "content-type": contentType } })

        let zipFilePath: string | undefined
        const writes: Promise<void>[] = []

        busboy.on("file", (fieldName, stream, filename) => {
            if (fieldName !== "artifact") {
                stream.resume()
                return
            }

            const filePath = join(tmpdir(), `gueterbahnhof-${randomUUID()}-${filename}`)
            zipFilePath = filePath

            writes.push(
                new Promise((resolveWrite, rejectWrite) => {
                    const writer = createWriteStream(filePath, { flags: "w" })
                    stream.pipe(writer)

                    writer.on("error", rejectWrite)
                    writer.on("close", () => resolveWrite())
                }),
            )
        })

        busboy.on("error", reject)

        busboy.on("finish", () => {
            Promise.all(writes)
                .then(() => resolve(zipFilePath))
                .catch(reject)
        })

        request.body.pipeTo(Writable.toWeb(busboy) as WritableStream).catch(reject)
    })
