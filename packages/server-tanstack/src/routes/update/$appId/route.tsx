import { randomUUID } from "node:crypto"
import { createWriteStream, mkdirSync, readFileSync, rmSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { Writable } from "node:stream"
import Busboy from "@fastify/busboy"
import { createFileRoute } from "@tanstack/react-router"
import { default as AdmZip } from "adm-zip"

type MultipartParserData = Record<string, string | { fileName: string; filePath: string }>

export const Route = createFileRoute("/update/$appId")({
    component: UpdateAppArtifactPage,
    server: {
        handlers: {
            async POST({ request }) {
                if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
                    throw new Response("Only multipart/form-data allowed.", { status: 400 })
                }

                const data = await new Promise<MultipartParserData>((resolve, reject) => {
                    const result: MultipartParserData = {}

                    const promises: Promise<unknown>[] = []

                    const busboy = new Busboy({
                        headers: {
                            "content-type": "multipart/form-data",
                            ...Object.fromEntries(request.headers.entries()),
                        },
                    })

                    busboy.on("error", error => reject(error))

                    busboy.on("field", (fieldName, value) => {
                        result[fieldName] = value
                    })

                    busboy.on(
                        "file",
                        async (fieldname, stream, filename, _transferEncoding, mimeType) => {
                            console.log(
                                `Field: ${fieldname}. File: ${filename}. MimeType: ${mimeType}.`,
                            )

                            promises.push(
                                new Promise<void>((resolve, reject) => {
                                    const id = randomUUID()
                                    const zipFilePath = join(os.tmpdir(), id + filename)
                                    const fileWriter = createWriteStream(zipFilePath, {
                                        flags: "w",
                                    })
                                    stream.pipe(fileWriter)

                                    fileWriter.on("error", reject)

                                    fileWriter.on("close", () => {
                                        console.log("Stream ended.")

                                        result[fieldname] = {
                                            fileName: filename,
                                            filePath: zipFilePath,
                                        }

                                        resolve()
                                    })
                                }),
                            )
                        },
                    )

                    busboy.on("finish", () => {
                        console.log("FINISH")
                        Promise.all(promises).then(() => {
                            resolve(result)
                        })
                    })

                    request.body?.pipeTo(Writable.toWeb(busboy) as WritableStream)
                })

                if ("artifact" in data && typeof data.artifact !== "string") {
                    const filePath = join(
                        os.tmpdir(),
                        `${randomUUID()}-${data.artifact.fileName.split(".").slice(0, -1).join(".")}`,
                    )

                    console.log("FILEPATH", filePath)

                    try {
                        mkdirSync(filePath, { recursive: true })

                        const zip = new AdmZip(readFileSync(data.artifact.filePath))
                        zip.extractAllTo(filePath)

                        rmSync(data.artifact.filePath, { recursive: true, force: true })
                        data.artifact.filePath = filePath
                    } catch (e) {
                        console.error("ERROR unzipping:", e)
                    }
                }

                return Response.json(data)
            },
        },
    },
})

function UpdateAppArtifactPage() {
    return (
        <form
            encType="multipart/form-data"
            onSubmit={ev => {
                ev.preventDefault()
                fetch("", {
                    method: "POST",
                    body: new FormData(ev.currentTarget),
                })
            }}
        >
            <label>
                Artifact
                <input name={"artifact"} type={"file"} />
            </label>
            <input type={"hidden"} name={"appName"} value={Route.useParams().appId} />
            <button>SUBMIT</button>
        </form>
    )
}
