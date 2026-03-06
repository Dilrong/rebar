import type { ReactNode } from "react"
import AppNav from "@shared/layout/app-nav"
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
    <div className={cn("min-h-screen bg-background p-4 font-sans selection:bg-accent selection:text-white md:p-6", rootClassName)}>
      <main className={cn("mx-auto w-full animate-fade-in-up pb-24", mainClassName)}>
        <AppNav />
        {children}
      </main>
    </div>
  )
}
