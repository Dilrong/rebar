import type { ReactNode } from "react"
import AppNav from "@/components/layout/app-nav"
import { cn } from "@/lib/utils"

export default function ProtectedPageShell({
  children,
  mainClassName,
  rootClassName
}: {
  children: ReactNode
  mainClassName?: string
  rootClassName?: string
}) {
  return (
    <div className={cn("min-h-screen bg-background p-6 font-sans selection:bg-accent selection:text-white", rootClassName)}>
      <main className={cn("mx-auto animate-fade-in-up pb-24", mainClassName)}>
        <AppNav />
        {children}
      </main>
    </div>
  )
}
