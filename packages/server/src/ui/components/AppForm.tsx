import React from "react"
import type { AppConfig } from "../../app/appConfigDb"
import { EnvInput } from "./EnvInput"

const configName = (s: keyof AppConfig) => s

export const AppForm = ({ appConfig }: { appConfig?: AppConfig }) => {
    return (
        <main className={"pt-8"}>
            <h1 className={"mb-2"}>Edit App</h1>
            {appConfig && <h2>{appConfig.name}</h2>}
            <form
                className={"mt-4 w-full max-w-screen-sm space-y-4"}
                hx-post={"/ui/app"}
                hx-target={"#submission-message"}
                hx-indicator={"#savebtn"}
            >
                <button name={"intent"} value={"save"} className={"hidden"}>
                    Default button intent
                </button>
                <input type={"hidden"} name={"initialName"} defaultValue={appConfig?.name} />
                <label className={"block"}>
                    <div>AppName</div>
                    <input name={configName("name")} defaultValue={appConfig?.name} />
                </label>
                <label className={"block"}>
                    <div>Entry</div>
                    <input name={configName("entry")} defaultValue={appConfig?.entry} />
                </label>
                <fieldset>
                    <legend>Env</legend>
                    <ul id={"envs"}>
                        {Object.entries(appConfig?.env || { "": "" }).map(([key, value]) => (
                            <EnvInput key={key} name={key} value={value} />
                        ))}
                    </ul>
                    <button
                        type={"button"}
                        data-size={"sm"}
                        hx-post="/ui/add-env"
                        hx-trigger="click"
                        hx-target="#envs"
                        hx-swap="beforeend"
                        className={"w-full"}
                    >
                        +
                    </button>
                </fieldset>
                <footer className={"!mt-12 flex justify-between"}>
                    {appConfig && (
                        <button
                            id={"deletebtn"}
                            name={"intent"}
                            value={"delete"}
                            data-variant="destructive"
                        >
                            delete
                        </button>
                    )}
                    <button id={"savebtn"} name={"intent"} value={"save"} data-variant="primary">
                        save
                    </button>
                </footer>
            </form>
            <div id={"submission-message"}></div>
        </main>
    )
}
