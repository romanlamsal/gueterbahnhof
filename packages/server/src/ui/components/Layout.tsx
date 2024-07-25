import React, { PropsWithChildren } from "react"
import { AppList, AppListProps } from "./AppList"
import { Root } from "./Root"

export const Layout = (props: PropsWithChildren<AppListProps>) => {
    return (
        <Root>
            <main className={"grid grid-cols-[12rem_1fr] gap-x-8"}>
                <aside>
                    <AppList appStates={props.appStates} active={props.active}></AppList>
                </aside>
                <section>{props.children}</section>
            </main>
        </Root>
    )
}
