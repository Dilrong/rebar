import Link from "next/link"
import { BookOpen, CheckSquare, Moon, Plus, RefreshCw, Search, Sun, User } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_LINKS = ["capture", "review", "library", "search"] as const

type NavDesktopProps = {
  t: (key: string, fallback?: string) => string
  pathname: string
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

export function NavDesktop({
  t,
  pathname,
  homeHref,
  authEmail,
  mounted,
  theme,
  syncStatusLabel,
  syncFetching,
  syncError,
  onSync,
  onToggleTheme
}: NavDesktopProps) {
  return (
    <nav className="hidden md:flex mb-12 flex-row items-center justify-between border-b-4 border-foreground bg-background bg-noise py-6 gap-4">
      <div className="flex flex-row items-center gap-6 justify-between w-auto">
        <Link
          href={homeHref}
          className="rotate-[-2deg] self-start border-4 border-foreground bg-accent px-2 py-1 font-black text-3xl uppercase tracking-tighter text-white shadow-brutal transition-all duration-200 hover:rotate-0 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
        >
          REBAR_
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {NAV_LINKS.map((segment) => {
            const Icon =
              segment === "capture" ? Plus :
                segment === "review" ? CheckSquare :
                  segment === "library" ? BookOpen : Search

            return (
              <Link
                key={segment}
                href={`/${segment}`}
                title={t(`nav.${segment}`)}
                aria-label={t(`nav.${segment}`)}
                className={cn(
                  "border-2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-all duration-200",
                  pathname.startsWith(`/${segment}`)
                    ? "border-foreground bg-foreground text-background translate-x-1 translate-y-1 shadow-none"
                    : "border-transparent text-muted-foreground hover:border-foreground hover:text-foreground hover:shadow-brutal-sm hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2.5} />
                <span className="sr-only">{t(`nav.${segment}`)}</span>
              </Link>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSync}
          disabled={syncFetching}
          className={cn(
            "min-h-[44px] min-w-[44px] flex items-center justify-center border-2 p-2 transition-all duration-200 active:translate-y-1 active:translate-x-1 active:shadow-none",
            syncError
              ? "border-destructive text-destructive bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground shadow-brutal-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              : syncFetching
                ? "border-accent text-accent shadow-brutal-sm"
                : "border-transparent text-muted-foreground hover:border-foreground hover:text-foreground hover:shadow-brutal-sm hover:-translate-x-1 hover:-translate-y-1"
          )}
          title={syncStatusLabel}
        >
          <RefreshCw className={cn("h-5 w-5", syncFetching && "animate-spin")} strokeWidth={2.5} />
        </button>
        {syncError ? (
          <span
            className="inline-flex h-3 w-3 border-2 border-foreground bg-destructive shadow-brutal-sm"
            aria-label={syncStatusLabel}
            title={syncStatusLabel}
          />
        ) : null}

        {authEmail ? (
          <Link
            href="/settings"
            title={authEmail}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center border-2 border-transparent text-muted-foreground hover:border-foreground hover:text-foreground hover:shadow-brutal-sm hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-200"
          >
            <User className="h-5 w-5" strokeWidth={2.5} />
          </Link>
        ) : (
          <Link
            href="/signup"
            className="min-h-[44px] px-3 flex items-center justify-center border-2 border-foreground bg-background font-mono text-xs font-bold text-foreground hover:bg-foreground hover:text-background shadow-brutal-sm transition-all duration-200 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            title={t("nav.auth")}
          >
            AUTH
          </Link>
        )}

        <button
          onClick={onToggleTheme}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center border-2 border-transparent text-muted-foreground hover:border-foreground hover:text-foreground hover:shadow-brutal-sm hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-200"
          aria-label={t("nav.theme")}
          title="Toggle Theme"
          type="button"
        >
          {mounted ? (
            theme === "dark" ? (
              <Moon className="h-5 w-5" strokeWidth={2.5} />
            ) : (
              <Sun className="h-5 w-5" strokeWidth={2.5} />
            )
          ) : (
            <Sun className="h-5 w-5" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </nav>
  )
}
