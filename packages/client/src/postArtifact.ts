import { Blob, FormData } from "formdata-node"
import AdmZip from "adm-zip"
import got from "got"

export type PostArtifactArgs = { appName: string; host: string; apiKey?: string }

export async function postArtifact({ appName, host, apiKey }: PostArtifactArgs, directoryPath: string) {
    const zip = new AdmZip()
    zip.addLocalFolder(directoryPath)

    const formData = new FormData()
    const zipBuffer = zip.toBuffer()
    formData.set("artifact", new Blob([zipBuffer]))
    formData.set("check", "true")

    got(`${host}/update/${appName}`, {
        method: "POST",
        body: formData,
        headers: {
            authorization: apiKey,
        },
    })
        .json()
        .then(() => {
            console.log("Succesfully deployed.")
        })
        .catch(err => {
            console.error("ERROR:", err.code, err.name)
        })
}
