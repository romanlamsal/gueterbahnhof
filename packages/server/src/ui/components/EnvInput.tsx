import React from "react"

export const EnvInput = ({ name, value }: { name?: string; value?: string }) => (
    <li className={"mb-2 grid grid-cols-[auto_1fr_auto] space-x-2"}>
        <input name={"envname"} defaultValue={name} />
        <input name={"envvalue"} defaultValue={value} />
        <button
            hx-delete="/ui/add-env"
            hx-trigger={"click"}
            hx-swap={"delete"}
            hx-target={"closest li"}
            type={"button"}
            data-size={"sm"}
            className={"rounded-full border border-red-900 bg-red-200"}
        >
            -
        </button>
    </li>
)
