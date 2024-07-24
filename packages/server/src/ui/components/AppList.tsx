import React from "react"
import { Root } from "./Root"
import { AppState } from "../../app/appState"

export const AppList = ({ appStates }: { appStates: { [key: string]: AppState } }) => {
    return (
        <Root>
            <ul>
                {Object.entries(appStates).map(([name, { state }]) => (
                    <li key={name}>
                        <a href={`/ui/app/${name}`}>{name}</a>:<span>{state}</span>
                    </li>
                ))}
            </ul>
            <a href={"/ui/app"} className={"rounded-xl border px-2 py-1"}>
                Add app
            </a>
        </Root>
    )
}
