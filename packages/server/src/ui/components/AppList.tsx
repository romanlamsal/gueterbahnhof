import React from "react"
import type { AppState } from "../../app/appState"
import { clsx } from "clsx"

export type AppListProps = { appStates: { [key: string]: AppState }; active?: string }

export const AppList = ({ appStates, active }: AppListProps) => {
    return (
        <ul>
            {Object.entries(appStates).map(([name, { state }]) => (
                <li key={name}>
                    <a
                        href={`/ui/app/${name}`}
                        className={clsx(
                            "flex h-[4rem] w-full items-center rounded-br-2xl border bg-white px-2",
                            active === name ? "border-black" : "border-gray-200",
                        )}
                    >
                        {name}
                        <span
                            className={clsx("inline-block h-2 w-2 rounded-full border-transparent", {
                                "bg-yellow-600": state === "pending",
                                "bg-green-600": state === "started",
                                "bg-red-600": state === "errored-start",
                            })}
                        ></span>
                    </a>
                </li>
            ))}
            <li>
                <a href={"/ui/app"} className={"rounded-xl border px-2 py-1"}>
                    Add app
                </a>
            </li>
        </ul>
    )
}
