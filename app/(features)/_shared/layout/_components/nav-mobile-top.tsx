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
    <nav className="flex md:hidden sticky top-0 z-30 bg-background mb-4 flex-row items-center justify-between border-b-[3px] border-foreground py-2 px-3 gap-2 shadow-brutal-sm">
      <Link
        href={homeHref}
        className="rotate-[-2deg] self-start border-2 border-foreground bg-accent px-2 py-0.5 mt-0.5 font-black text-xl uppercase tracking-tighter text-white shadow-brutal-sm transition-transform hover:rotate-0"
      >
        REBAR_
      </Link>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSync}
          disabled={syncFetching}
          className={cn(
            "min-h-[36px] min-w-[36px] flex items-center justify-center border-2 border-foreground bg-background p-1.5 shadow-brutal-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all",
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
            className="min-h-[36px] min-w-[36px] flex items-center justify-center border-2 border-foreground bg-background p-1.5 shadow-brutal-sm text-foreground active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all"
          >
            <User className="h-4 w-4" strokeWidth={3} />
          </Link>
        ) : (
          <Link
            href="/signup"
            className="min-h-[36px] flex items-center justify-center border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold text-foreground shadow-brutal-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all"
          >
            AUTH
          </Link>
        )}
        <button
          onClick={onToggleTheme}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center border-2 border-foreground bg-background p-1.5 shadow-brutal-sm text-foreground active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all"
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
