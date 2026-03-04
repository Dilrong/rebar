"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Search, Square, Plus, BookOpen, CheckSquare, BriefcaseBusiness } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { cn } from "@/lib/utils"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { getStartPagePreference } from "@feature-lib/settings/preferences"
import { useIsFetching, useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"

const NAV_LINKS = ["capture", "review", "library", "search", "projects"] as const

type SyncHealthResponse = {
  authenticated: boolean
}

function formatSyncAge(updatedAt: number | null): string {
  if (!updatedAt) {
    return "--"
  }

  const diffSec = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))
  if (diffSec < 60) {
    return `${diffSec}s`
  }

  const diffMin = Math.floor(diffSec / 60)
  return `${diffMin}m`
}

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [homeHref, setHomeHref] = useState("/")
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickQuery, setQuickQuery] = useState("")
  const [quickResults, setQuickResults] = useState<Array<{ id: string; kind: string; content: string }>>([])
  const [quickActiveIndex, setQuickActiveIndex] = useState(-1)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const quickDialogRef = useRef<HTMLDivElement | null>(null)
  const quickInputRef = useRef<HTMLInputElement | null>(null)
  const fetchingCount = useIsFetching()

  const syncHealth = useQuery({
    queryKey: ["sync-health"],
    queryFn: () => apiFetch<SyncHealthResponse>("/api/auth/check"),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: 1
  })

  useEffect(() => {
    if (syncHealth.dataUpdatedAt > 0) {
      setLastSyncAt(syncHealth.dataUpdatedAt)
    }
  }, [syncHealth.dataUpdatedAt])

  const syncStatusLabel = syncHealth.isError
    ? t("nav.syncError", "SYNC ERR")
    : fetchingCount > 0
      ? t("nav.syncing", "SYNCING...")
      : `${t("nav.synced", "SYNCED")} ${formatSyncAge(lastSyncAt)}`

  useEffect(() => {
    setMounted(true)
    try {
      const supabase = getSupabaseBrowser()
      supabase.auth.getUser().then(({ data }) => {
        setAuthEmail(data.user?.email ?? null)
      })

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthEmail(session?.user?.email ?? null)
      })

      return () => {
        data.subscription.unsubscribe()
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Auth client init failed")
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setQuickOpen(true)
      }
      if (event.key === "Escape") {
        setQuickOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!quickOpen) {
      return
    }
    if (!quickQuery.trim()) {
      setQuickResults([])
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(quickQuery.trim())}&limit=5`)
        const data = (await response.json()) as { data?: Array<{ id: string; kind: string; content: string }> }
        setQuickResults(data.data ?? [])
      } catch {
        setQuickResults([])
      }
    }, 180)

    return () => window.clearTimeout(timer)
  }, [quickOpen, quickQuery])

  useEffect(() => {
    if (!quickOpen) {
      setQuickActiveIndex(-1)
      return
    }

    quickInputRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return
      }

      const container = quickDialogRef.current
      if (!container) {
        return
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => !node.hasAttribute("disabled"))

      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [quickOpen])

  useEffect(() => {
    setHomeHref(getStartPagePreference())
  }, [])

  const handleSignOut = async () => {
    setPending(true)
    setAuthError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.auth.signOut()

      if (error) {
        setAuthError(error.message)
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Logout failed")
    } finally {
      setPending(false)
    }
  }

  const handleQuickInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!quickResults.length) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setQuickActiveIndex((idx) => (idx + 1) % quickResults.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setQuickActiveIndex((idx) => (idx <= 0 ? quickResults.length - 1 : idx - 1))
      return
    }

    if (event.key === "Enter" && quickActiveIndex >= 0) {
      event.preventDefault()
      const selected = quickResults[quickActiveIndex]
      setQuickOpen(false)
      router.push(`/records/${selected.id}`)
    }
  }

  return (
    <>
      {/* --- DESKTOP NAVIGATION --- */}
      <nav className="hidden md:flex mb-12 flex-row items-center justify-between border-b-4 border-foreground py-6 gap-4">
        <div className="flex flex-row items-center gap-6 justify-between w-auto">
          <Link
            href={homeHref}
            className="rotate-[-2deg] self-start border-2 border-foreground bg-accent px-2 py-1 font-black text-3xl uppercase tracking-tighter text-white shadow-brutal-sm transition-transform hover:rotate-0"
          >
            REBAR_
          </Link>
          <div className="flex flex-wrap items-center gap-1">
            {NAV_LINKS.map((segment) => (
              <Link
                key={segment}
                href={`/${segment}`}
                className={cn(
                  "border-2 px-3 py-2 min-h-[44px] flex items-center justify-center font-mono text-sm font-bold transition-all",
                  pathname === `/${segment}`
                    ? "translate-x-[-2px] translate-y-[-2px] border-foreground bg-foreground text-background shadow-brutal-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                [{t(`nav.${segment}`)}]
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => syncHealth.refetch()}
            disabled={syncHealth.isFetching}
            className={cn(
              "min-h-[44px] flex items-center justify-center border-2 px-3 py-2 font-mono text-[10px] font-bold uppercase transition-colors",
              syncHealth.isError
                ? "border-destructive text-destructive"
                : fetchingCount > 0
                  ? "border-accent text-accent"
                  : "border-foreground text-foreground hover:bg-foreground hover:text-background"
            )}
            title={t("nav.syncHint", "Click to refresh sync status")}
          >
            {syncStatusLabel}
          </button>
          {authEmail ? (
            <>
              <Link
                href="/settings"
                title={authEmail}
                className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold text-foreground hover:bg-foreground hover:text-background"
              >
                {t("nav.profile", "PROFILE")}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={pending}
                className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold text-foreground hover:bg-foreground hover:text-background transition-colors"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <Link
              href="/signup"
              className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold text-foreground"
            >
              {t("nav.auth")}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-foreground hover:bg-foreground hover:text-background transition-colors"
            aria-label="Quick search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="min-h-[44px] flex items-center justify-center active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
            aria-label={t("nav.theme")}
            type="button"
          >
            {mounted && (
              <Square
                size={18}
                strokeWidth={3}
                className={cn(
                  "border-2 border-foreground bg-background p-2.5 text-foreground shadow-brutal-sm hover:bg-muted",
                  theme === "dark" && "fill-accent"
                )}
              />
            )}
          </button>
        </div>
      </nav>

      {/* --- MOBILE TOP BAR (Logo + Theme/Profile only) --- */}
      <nav className="flex md:hidden mb-6 flex-row items-center justify-between border-b-4 border-foreground py-4 gap-2">
        <Link
          href={homeHref}
          className="rotate-[-2deg] self-start border-2 border-foreground bg-accent px-2 py-1 font-black text-2xl uppercase tracking-tighter text-white shadow-brutal-sm transition-transform hover:rotate-0"
        >
          REBAR_
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => syncHealth.refetch()}
            disabled={syncHealth.isFetching}
            className={cn(
              "min-h-[44px] flex items-center justify-center border-2 px-2 py-2 font-mono text-[9px] font-bold uppercase",
              syncHealth.isError
                ? "border-destructive text-destructive"
                : fetchingCount > 0
                  ? "border-accent text-accent"
                  : "border-foreground text-foreground"
            )}
            title={t("nav.syncHint", "Click to refresh sync status")}
          >
            {syncStatusLabel}
          </button>
          {authEmail ? (
            <Link
              href="/settings"
              title={authEmail}
              className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold text-foreground"
            >
              {t("nav.profile", "USER")}
            </Link>
          ) : (
            <Link
              href="/signup"
              className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold text-foreground"
            >
              {t("nav.auth")}
            </Link>
          )}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="min-h-[44px] flex items-center justify-center active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
            aria-label={t("nav.theme")}
            type="button"
          >
            {mounted && (
              <Square
                size={16}
                strokeWidth={3}
                className={cn(
                  "border-2 border-foreground bg-background p-2 text-foreground shadow-brutal-sm hover:bg-muted",
                  theme === "dark" && "fill-accent"
                )}
              />
            )}
          </button>
        </div>
      </nav>

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t-4 border-foreground bg-background shadow-[0_-4px_0_0_rgba(0,0,0,1)] pb-[env(safe-area-inset-bottom)] dark:shadow-[0_-4px_0_0_rgba(255,255,255,0.1)]">
        <div className="flex flex-row items-center justify-around px-2 py-2 relative">

          <Link
            href="/library"
            className={cn(
              "flex flex-col items-center justify-center p-2 min-w-[64px] transition-colors",
              pathname.includes("/library") ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="h-6 w-6 stroke-[2.5]" />
            <span className="font-mono text-[9px] font-bold uppercase mt-1">LIBRARY</span>
          </Link>

          <Link
            href="/review"
            className={cn(
              "flex flex-col items-center justify-center p-2 min-w-[64px] transition-colors",
              pathname.includes("/review") ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckSquare className="h-6 w-6 stroke-[2.5]" />
            <span className="font-mono text-[9px] font-bold uppercase mt-1">REVIEW</span>
          </Link>

          {/* OVERSIZED CORE CAPTURE / FAB BUTTON */}
          <Link
            href="/capture"
            className="flex flex-col flex-1 items-center justify-center relative -top-6"
          >
            <div className={cn(
              "flex h-16 w-16 items-center justify-center border-4 border-foreground bg-accent shadow-brutal transition-transform active:translate-y-1 active:shadow-none rounded-none rotate-3",
              pathname === "/capture" && "bg-foreground text-background"
            )}>
              <Plus className="h-8 w-8 text-white stroke-[3] -rotate-3" />
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="flex flex-col items-center justify-center p-2 min-w-[64px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search className="h-6 w-6 stroke-[2.5]" />
            <span className="font-mono text-[9px] font-bold uppercase mt-1">SEARCH</span>
          </button>

          <Link
            href="/projects"
            className={cn(
              "flex flex-col items-center justify-center p-2 min-w-[64px] transition-colors",
              pathname.includes("/projects") ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BriefcaseBusiness className="h-6 w-6 stroke-[2.5]" />
            <span className="font-mono text-[9px] font-bold uppercase mt-1">PROJ</span>
          </Link>

        </div>
      </div>

      {authError ? <p className="font-mono text-xs text-destructive mt-[-1rem] mb-4">{authError}</p> : null}

      {quickOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 transition-all"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setQuickOpen(false)
            }
          }}
        >
          <div
            ref={quickDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-search-title"
            aria-describedby="quick-search-description"
            className="mt-16 w-full max-w-2xl border-4 border-foreground bg-card p-4 shadow-brutal"
          >
            <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-foreground pb-2 gap-2">
              <p id="quick-search-title" className="font-mono text-xs font-bold uppercase">QUICK SEARCH (⌘K / Ctrl+K)</p>
              <button type="button" onClick={() => setQuickOpen(false)} className="min-h-[44px] flex items-center justify-center border-2 border-foreground px-4 py-2 font-mono text-xs font-bold uppercase w-full sm:w-auto hover:bg-foreground hover:text-background active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">
                CLOSE
              </button>
            </div>
            <p id="quick-search-description" className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              키보드: ↑↓ 이동, Enter 열기, Esc 닫기
            </p>
            <input
              ref={quickInputRef}
              value={quickQuery}
              onChange={(event) => setQuickQuery(event.target.value)}
              onKeyDown={handleQuickInputKeyDown}
              placeholder="검색어 입력..."
              className="mb-3 w-full border-2 border-foreground bg-background p-3 font-mono text-sm min-h-[44px]"
              role="combobox"
              aria-expanded={quickResults.length > 0}
              aria-controls="quick-search-results"
              aria-activedescendant={quickActiveIndex >= 0 ? `quick-option-${quickActiveIndex}` : undefined}
              autoFocus
            />
            <div id="quick-search-results" role="listbox" className="space-y-2">
              {quickResults.map((item, index) => (
                <Link
                  key={item.id}
                  id={`quick-option-${index}`}
                  role="option"
                  aria-selected={quickActiveIndex === index}
                  href={`/records/${item.id}`}
                  onClick={() => setQuickOpen(false)}
                  onMouseEnter={() => setQuickActiveIndex(index)}
                  className={cn(
                    "block border-2 min-h-[44px] border-foreground px-3 py-2 hover:bg-foreground hover:text-background active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all",
                    quickActiveIndex === index && "bg-foreground text-background"
                  )}
                >
                  <p className="font-mono text-[10px] font-bold uppercase">{item.kind}</p>
                  <p className="line-clamp-2 text-sm font-semibold">{item.content}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
