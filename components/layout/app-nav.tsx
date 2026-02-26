"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Square } from "lucide-react"
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
          className="rotate-[-2deg] border-2 border-foreground bg-accent px-2 py-1 font-black text-3xl uppercase tracking-tighter text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform hover:rotate-0 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]"
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
                  ? "translate-x-[-2px] translate-y-[-2px] border-foreground bg-foreground text-background shadow-[2px_2px_0px_0px_theme(colors.accent)]"
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
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="active:translate-y-[2px] active:translate-x-[2px] active:shadow-none dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]" 
          aria-label={t("nav.theme")}
          type="button"
        >
          {mounted && (
            <Square
              size={18}
              strokeWidth={3}
              className={cn(
                "border-2 border-foreground bg-background p-2 text-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-muted",
                theme === "dark" && "fill-accent"
              )}
            />
          )}
        </button>
      </div>
      {authError ? <p className="font-mono text-xs text-destructive">{authError}</p> : null}
    </nav>
  )
}
