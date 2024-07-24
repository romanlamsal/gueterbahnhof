import React from "react"
import { AppConfig } from "../../app/appConfigDb"
import { EnvInput } from "./EnvInput"
import { Root } from "./Root"

const configName = (s: keyof AppConfig) => s

export const AppForm = ({ appConfig }: { appConfig?: AppConfig }) => {
    return (
        <Root>
            <form hx-post={"/ui/app"} className={"p-4"} hx-target={"#submission-message"} hx-indicator={"#savebtn"}>
                <button name={"intent"} value={"save"} className={"hidden"}>
                    Default button intent
                </button>
                <input type={"hidden"} name={"initialName"} defaultValue={appConfig?.name} />
                <label>
                    <div>AppName</div>
                    <input className={"rounded-xl border"} name={configName("name")} defaultValue={appConfig?.name} />
                </label>
                <label>
                    <div>Entry</div>
                    <input className={"rounded-xl border"} name={configName("entry")} defaultValue={appConfig?.entry} />
                </label>
                <fieldset>
                    <legend>Env</legend>
                    <ul id={"envs"}>
                        {Object.entries(appConfig?.env || { "": "" }).map(([key, value]) => (
                            <EnvInput key={key} name={key} value={value} />
                        ))}
                    </ul>
                    <button
                        className={"rounded border px-1"}
                        type={"button"}
                        hx-post="/ui/add-env"
                        hx-trigger="click"
                        hx-target="#envs"
                        hx-swap="beforeend"
                    >
                        +
                    </button>
                </fieldset>
                {appConfig && (
                    <button
                        id={"deletebtn"}
                        name={"intent"}
                        value={"delete"}
                        className={"rounded-xl border border-transparent bg-red-900 px-4 text-slate-50"}
                    >
                        delete
                    </button>
                )}
                <button
                    id={"savebtn"}
                    name={"intent"}
                    value={"save"}
                    className={"rounded-xl border border-transparent bg-slate-900 px-4 text-slate-50"}
                >
                    save
                </button>
            </form>
            <div id={"submission-message"}></div>
        </Root>
    )
}
