"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Search, Square } from "lucide-react"
import { useEffect, useState } from "react"
import { useI18n } from "@/components/i18n/i18n-provider"
import { cn } from "@/lib/utils"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { getStartPagePreference } from "@/lib/preferences"

const NAV_LINKS = ["capture", "review", "library", "search"] as const

export default function AppNav() {
  const pathname = usePathname()
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

  return (
    <nav className="mb-12 flex items-center justify-between border-b-4 border-foreground py-6">
      <div className="flex items-center gap-6">
        <Link
          href={homeHref}
          className="rotate-[-2deg] border-2 border-foreground bg-accent px-2 py-1 font-black text-3xl uppercase tracking-tighter text-white shadow-brutal-sm transition-transform hover:rotate-0"
        >
          REBAR_
        </Link>
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((segment) => (
            <Link
              key={segment}
              href={`/${segment}`}
              className={cn(
                "border-2 px-3 py-1.5 font-mono text-sm font-bold transition-all",
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
      <div className="flex items-center gap-2">
        {authEmail ? (
          <>
            <Link
              href="/settings"
              title={authEmail}
              className="border-2 border-foreground bg-background px-2 py-1 font-mono text-xs font-bold text-foreground hover:bg-foreground hover:text-background"
            >
              {t("nav.profile", "PROFILE")}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={pending}
              className="border-2 border-foreground bg-background px-2 py-1 font-mono text-xs font-bold text-foreground"
            >
              {t("nav.logout")}
            </button>
          </>
        ) : (
          <Link
            href="/signup"
            className="border-2 border-foreground bg-background px-2 py-1 font-mono text-xs font-bold text-foreground"
          >
            {t("nav.auth")}
          </Link>
        )}

        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          className="border-2 border-foreground bg-background px-2 py-1 font-mono text-xs font-bold uppercase text-foreground"
          aria-label="Quick search"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
          aria-label={t("nav.theme")}
          type="button"
        >
          {mounted && (
            <Square
              size={18}
              strokeWidth={3}
              className={cn(
                "border-2 border-foreground bg-background p-2 text-foreground shadow-brutal-sm hover:bg-muted",
                theme === "dark" && "fill-accent"
              )}
            />
          )}
        </button>
      </div>
      {authError ? <p className="font-mono text-xs text-destructive">{authError}</p> : null}

      {quickOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4">
          <div className="mt-16 w-full max-w-2xl border-4 border-foreground bg-card p-4 shadow-brutal">
            <div className="mb-3 flex items-center justify-between border-b-2 border-foreground pb-2">
              <p className="font-mono text-xs font-bold uppercase">QUICK SEARCH (⌘K / Ctrl+K)</p>
              <button type="button" onClick={() => setQuickOpen(false)} className="border-2 border-foreground px-2 py-1 font-mono text-xs font-bold uppercase">
                CLOSE
              </button>
            </div>
            <input
              value={quickQuery}
              onChange={(event) => setQuickQuery(event.target.value)}
              placeholder="검색어 입력..."
              className="mb-3 w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              autoFocus
            />
            <div className="space-y-2">
              {quickResults.map((item) => (
                <Link
                  key={item.id}
                  href={`/records/${item.id}`}
                  onClick={() => setQuickOpen(false)}
                  className="block border-2 border-foreground px-3 py-2 hover:bg-foreground hover:text-background"
                >
                  <p className="font-mono text-[10px] font-bold uppercase">{item.kind}</p>
                  <p className="line-clamp-2 text-sm font-semibold">{item.content}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  )
}
