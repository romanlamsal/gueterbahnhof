import { Check } from "lucide-react"
import { type ComponentProps, type MouseEvent, useEffect, useState } from "react"
import { Button } from "@/components/ui/button.tsx"

export const SaveButton = ({
    iconPosition,
    onClick,
    ...buttonProps
}: Omit<ComponentProps<typeof Button>, "onClick"> & {
    iconPosition: "left" | "right"
    onClick?: (ev: MouseEvent<HTMLButtonElement>) => unknown | Promise<unknown>
}) => {
    const [showIcon, setShowIcon] = useState(false)
    useEffect(() => {
        if (!showIcon) {
            return
        }

        const timeoutId = setTimeout(() => {
            setShowIcon(false)
        }, 3000)

        return () => {
            clearTimeout(timeoutId)
        }
    }, [showIcon])

    return (
        <>
            {showIcon && iconPosition === "left" && <Check className={"mr-1 inline size-4 text-green-500"} />}
            <Button
                {...buttonProps}
                onClick={ev => {
                    const onClickResult = onClick?.(ev)
                    if (onClickResult instanceof Promise) {
                        onClickResult.then(() => {
                            setShowIcon(true)
                        })
                    }
                }}
            />
            {showIcon && iconPosition === "right" && <Check className={"ml-1 inline size-4 text-green-500"} />}
        </>
    )
}
