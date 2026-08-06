import { Check, Loader2 } from "lucide-react"
import { type ComponentProps, useEffect, useState } from "react"
import { Button } from "@/components/ui/button.tsx"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

const FADE_AFTER_MS = 3000

// Driven by the caller's mutation state rather than by a promise handed to
// onClick: the previous version only lit up when onClick returned a promise,
// so a plain form submit never showed anything at all.
export const SaveButton = ({
    status,
    message,
    children,
    ...buttonProps
}: ComponentProps<typeof Button> & { status: SaveStatus; message?: string }) => {
    const [faded, setFaded] = useState(false)

    useEffect(() => {
        if (status !== "saved") {
            setFaded(false)
            return
        }

        const timeoutId = setTimeout(() => setFaded(true), FADE_AFTER_MS)
        return () => clearTimeout(timeoutId)
    }, [status])

    return (
        <div className={"flex items-center gap-2"}>
            <Button {...buttonProps} disabled={buttonProps.disabled || status === "saving"}>
                {status === "saving" ? <Loader2 className={"mr-2 inline size-4 animate-spin"} /> : null}
                {children}
            </Button>

            {status === "saved" ? (
                <Check
                    aria-label={"Saved"}
                    className={`size-5 text-green-500 transition-opacity duration-1000 ${
                        faded ? "opacity-0" : "opacity-100"
                    }`}
                />
            ) : null}

            {status === "error" && message ? (
                <span role={"alert"} className={"text-red-500"}>
                    {message}
                </span>
            ) : null}
        </div>
    )
}
