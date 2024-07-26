import type { AppConfig} from "../app/appConfigDb";
import { saveAppConfig } from "../app/appConfigDb"
import { stopApp } from "../pm"
import { updateAppState } from "../app/appState"

export const updateAppConfig = async (formData: {
    initialName?: string
    name: string
    entry: string
    envname: string | string[]
    envvalue: string | string[]
}) => {
    if (!formData.name || !formData.entry) {
        return { ok: false, reason: "Entry missing." } as { ok: false; reason: string }
    }

    const envNames = Array.isArray(formData.envname) ? formData.envname : [formData.envname]
    const envValues = Array.isArray(formData.envvalue) ? formData.envvalue : [formData.envvalue]

    const config: AppConfig = {
        name: formData.name,
        entry: formData.entry,
        env: envNames.reduce<AppConfig["env"]>((acc, curr, dx) => {
            if (!curr || !envValues[dx]) {
                return acc
            }

            return { ...acc, [curr]: envValues[dx] } as AppConfig["env"]
        }, {}),
    }

    saveAppConfig(config)

    if (formData.initialName && formData.initialName !== config.name) {
        await stopApp(formData.initialName).catch(err => console.warn("Failed to stop app after config update:", err))
    }

    await updateAppState(config.name)

    return { ok: true } as const
}
