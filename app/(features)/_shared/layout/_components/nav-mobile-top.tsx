import Link from "next/link"
import { Moon, RefreshCw, Sun, User } from "lucide-react"
import { cn } from "@/lib/utils"

type NavMobileTopProps = {
  t: (key: string, fallback?: string) => string
  homeHref: string
  authEmail: string | null
  mounted: boolean
  theme: string | undefined
  syncStatusLabel: string
  syncFetching: boolean
  syncError: boolean
  onSync: () => void
  onToggleTheme: () => void
}

export function NavMobileTop({
  t,
  homeHref,
  authEmail,
  mounted,
  theme,
  syncStatusLabel,
  syncFetching,
  syncError,
  onSync,
  onToggleTheme
}: NavMobileTopProps) {
  return (
    <nav className="sticky top-0 z-30 mb-4 flex items-center gap-2 border-b-[3px] border-foreground bg-background bg-noise px-3 py-2 shadow-brutal-sm md:hidden">
      <Link
        href={homeHref}
        className="mt-0.5 inline-flex min-h-[44px] shrink-0 items-center rotate-[-2deg] self-start border-[3px] border-foreground bg-accent px-2 py-0.5 font-black text-xl uppercase tracking-tighter text-white shadow-brutal transition-all duration-200 hover:rotate-0 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
      >
        REBAR_
      </Link>
      <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
        <span
          className={cn(
            "hidden min-w-0 max-w-[108px] truncate border-2 px-2 py-1 font-mono text-[9px] font-bold uppercase min-[390px]:inline-flex",
            syncError ? "border-destructive text-destructive" : "border-foreground text-muted-foreground"
          )}
          aria-live="polite"
        >
          {syncStatusLabel}
        </span>
        <button
          type="button"
          onClick={onSync}
          disabled={syncFetching}
          className={cn(
            "min-h-[44px] min-w-[44px] flex items-center justify-center border-2 border-foreground bg-background p-1.5 shadow-brutal-sm active:translate-y-1 active:translate-x-1 active:shadow-none transition-all duration-200",
            syncError ? "text-destructive" : syncFetching ? "text-accent" : "text-foreground"
          )}
          title={syncStatusLabel}
        >
          <RefreshCw className={cn("h-4 w-4", syncFetching && "animate-spin")} strokeWidth={3} />
        </button>
        {authEmail ? (
          <Link
            href="/settings"
            title={authEmail}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center border-2 border-foreground bg-background p-1.5 shadow-brutal-sm text-foreground active:translate-y-1 active:translate-x-1 active:shadow-none transition-all duration-200 hover:bg-foreground hover:text-background"
          >
            <User className="h-4 w-4" strokeWidth={3} />
          </Link>
        ) : (
          <Link
            href="/signup"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold text-foreground shadow-brutal-sm active:translate-y-1 active:translate-x-1 active:shadow-none transition-all duration-200 hover:bg-foreground hover:text-background"
          >
            AUTH
          </Link>
        )}
        <button
          onClick={onToggleTheme}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center border-2 border-foreground bg-background p-1.5 shadow-brutal-sm text-foreground active:translate-y-1 active:translate-x-1 active:shadow-none transition-all duration-200 hover:bg-foreground hover:text-background"
          aria-label={t("nav.theme")}
          type="button"
        >
          {mounted ? (
            theme === "dark" ? (
              <Moon className="h-4 w-4" strokeWidth={3} />
            ) : (
              <Sun className="h-4 w-4" strokeWidth={3} />
            )
          ) : (
            <Sun className="h-4 w-4" strokeWidth={3} />
          )}
        </button>
      </div>
    </nav>
  )
}
