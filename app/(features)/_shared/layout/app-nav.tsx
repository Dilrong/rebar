"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import {
  getStartPagePreference,
  getPreferencesServer,
  setStartPagePreference
} from "@feature-lib/settings/preferences"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import { NavDesktop } from "./_components/nav-desktop"
import { NavMobileTop } from "./_components/nav-mobile-top"
import { NavMobileBottom } from "./_components/nav-mobile-bottom"
import { QuickSearchDialog, type QuickSearchResult } from "./_components/quick-search-dialog"

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
  const searchParams = useSearchParams()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [homeHref, setHomeHref] = useState("/")
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickQuery, setQuickQuery] = useState("")
  const [quickResults, setQuickResults] = useState<QuickSearchResult[]>([])
  const [quickActiveIndex, setQuickActiveIndex] = useState(-1)
  const [quickLoading, setQuickLoading] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const quickDialogRef = useRef<HTMLDivElement | null>(null)
  const quickInputRef = useRef<HTMLInputElement | null>(null)

  const currentQuery = searchParams.toString()
  const currentLocation = currentQuery ? `${pathname}?${currentQuery}` : pathname

  const buildRecordHref = (recordId: string) =>
    `/records/${recordId}?from=${encodeURIComponent(currentLocation)}`

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
    : syncHealth.isFetching
      ? t("nav.syncing", "SYNCING...")
      : `${t("nav.synced", "SYNCED")} ${formatSyncAge(lastSyncAt)}`

  useEffect(() => {
    setMounted(true)
    try {
      const supabase = getSupabaseBrowser()
      supabase.auth.getUser().then(({ data }: { data: any }) => {
        setAuthEmail(data.user?.email ?? null)
      })

      const { data } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
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
      setQuickLoading(false)
      return
    }
    if (!quickQuery.trim()) {
      setQuickResults([])
      setQuickActiveIndex(-1)
      setQuickLoading(false)
      return
    }

    let active = true
    setQuickLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(quickQuery.trim())}&limit=5`)
        const data = (await response.json()) as { data?: Array<{ id: string; kind: string; content: string }> }
        if (!active) {
          return
        }

        setQuickResults(data.data ?? [])
        setQuickActiveIndex(-1)
      } catch {
        if (!active) {
          return
        }

        setQuickResults([])
      } finally {
        if (active) {
          setQuickLoading(false)
        }
      }
    }, 180)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
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
      ).filter((node: any) => !node.hasAttribute("disabled"))

      if (focusable.length === 0) {
        return
      }

      const first = focusable[0] as HTMLElement
      const last = focusable[focusable.length - 1] as HTMLElement
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
    const localStartPage = getStartPagePreference()
    setHomeHref(localStartPage)

    void getPreferencesServer().then((serverPrefs) => {
      if (!serverPrefs.startPage) {
        return
      }

      setStartPagePreference(serverPrefs.startPage)
      setHomeHref(serverPrefs.startPage)
    })
  }, [])


  const handleQuickInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!quickResults.length) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setQuickActiveIndex((idx: number) => (idx + 1) % quickResults.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setQuickActiveIndex((idx: number) => (idx <= 0 ? quickResults.length - 1 : idx - 1))
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()

      const selected = quickResults[quickActiveIndex >= 0 ? quickActiveIndex : 0]
      if (!selected) {
        return
      }

      setQuickOpen(false)
      router.push(buildRecordHref(selected.id))
    }
  }

  return (
    <>
      <NavDesktop
        t={t}
        pathname={pathname}
        homeHref={homeHref}
        authEmail={authEmail}
        mounted={mounted}
        theme={theme}
        syncStatusLabel={syncStatusLabel}
        syncFetching={syncHealth.isFetching}
        syncError={syncHealth.isError}
        onSync={() => syncHealth.refetch()}
        onOpenQuickSearch={() => setQuickOpen(true)}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      <NavMobileTop
        t={t}
        homeHref={homeHref}
        authEmail={authEmail}
        mounted={mounted}
        theme={theme}
        syncStatusLabel={syncStatusLabel}
        syncFetching={syncHealth.isFetching}
        syncError={syncHealth.isError}
        onSync={() => syncHealth.refetch()}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      <NavMobileBottom pathname={pathname} />

      {authError ? <p className="font-mono text-xs text-destructive mt-[-1rem] mb-4">{authError}</p> : null}

      <QuickSearchDialog
        t={t}
        open={quickOpen}
        dialogRef={quickDialogRef}
        inputRef={quickInputRef}
        query={quickQuery}
        results={quickResults}
        activeIndex={quickActiveIndex}
        loading={quickLoading}
        onClose={() => setQuickOpen(false)}
        onQueryChange={setQuickQuery}
        onInputKeyDown={handleQuickInputKeyDown}
        onActiveIndexChange={setQuickActiveIndex}
        buildRecordHref={buildRecordHref}
      />
    </>
  )
}
