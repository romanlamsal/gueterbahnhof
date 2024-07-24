import React from "react"

export const EnvInput = ({ name, value }: { name?: string; value?: string }) => (
    <li>
        <input className={"rounded-xl border"} name={"envname"} defaultValue={name} />
        <input className={"rounded-xl border"} name={"envvalue"} defaultValue={value} />
        <button
            hx-delete="/ui/add-env"
            hx-trigger={"click"}
            hx-swap={"delete"}
            hx-target={"closest li"}
            type={"button"}
            className={"rounded-xl border-transparent bg-slate-900 px-2 py-1 text-slate-50"}
        >
            -
        </button>
    </li>
)
