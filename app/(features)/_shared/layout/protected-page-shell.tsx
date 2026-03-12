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
    <div className={cn("relative min-h-screen overflow-hidden bg-background p-4 font-sans", rootClassName)}>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground)/0.05)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.05)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,hsl(var(--accent)/0.12),transparent)]" />
        <div className="absolute left-0 right-0 top-24 h-px bg-foreground/10" />
        <div className="absolute right-[-5rem] top-20 h-40 w-40 rotate-12 border-4 border-foreground/10 bg-accent/10" />
      </div>
      <main className={cn("relative mx-auto w-full animate-fade-in-up", mainClassName)}>
        <AppNav />
        {children}
      </main>
    </div>
  )
}
