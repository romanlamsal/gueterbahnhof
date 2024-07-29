import React from "react"
import type { PropsWithChildren } from "react"

export const Root = ({ children }: PropsWithChildren<unknown>) => (
    <html lang="en">
        <head>
            <meta charSet="UTF-8" />
            <title>Gueterbahnhof Management UI</title>
            <link rel="stylesheet" href="/ui/assets/styles.css" />
        </head>
        <body className={"bg-gray-100"}>
            <div id={"app"}>{children}</div>
            <script type={"module"} src={"/ui/assets/entry-client.js"} />
        </body>
    </html>
)
