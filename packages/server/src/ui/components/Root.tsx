import React from "react"
import { PropsWithChildren } from "react"

export const Root = ({ children }: PropsWithChildren<unknown>) => (
    <html lang="en">
        <head>
            <meta charSet="UTF-8" />
            <title>Gueterbahnhof Management UI</title>
            <script
                src="https://unpkg.com/htmx.org@2.0.1"
                integrity="sha384-QWGpdj554B4ETpJJC9z+ZHJcA/i59TyjxEPXiiUgN2WmTyV5OEZWCD6gQhgkdpB/"
                crossOrigin="anonymous"
            ></script>
            <link rel="stylesheet" href="/ui/assets/styles.css" />
        </head>
        <body>{children}</body>
    </html>
)
