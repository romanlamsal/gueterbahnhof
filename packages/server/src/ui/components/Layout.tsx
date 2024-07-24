import React from "react"

export const Layout = () => {
    return (
        <button hx-get="/ui/hello" className={"rounded-xl border border-black px-2 py-1"}>
            ja hallo moin!
        </button>
    )
}
