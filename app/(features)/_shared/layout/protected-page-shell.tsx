import type { ReactNode } from "react"
import AppNav from "@shared/layout/app-nav"
import { cn } from "@/lib/utils"

type ProtectedPageShellProps = {
  children: ReactNode
  mainClassName?: string
  rootClassName?: string
}

export default function ProtectedPageShell({ children, mainClassName, rootClassName }: ProtectedPageShellProps) {
  return (
    <div className={cn("min-h-screen bg-background p-4 font-sans", rootClassName)}>
      <main className={cn("mx-auto w-full animate-fade-in-up", mainClassName)}>
        <AppNav />
        {children}
      </main>
    </div>
  )
}
