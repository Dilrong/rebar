import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse-brutal bg-foreground/20 border-4 border-foreground shadow-brutal", className)}
            {...props}
        />
    )
}

export { Skeleton }
