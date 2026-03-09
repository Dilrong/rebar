"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useState } from "react"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import { NavDesktop } from "./_components/nav-desktop"
import { NavMobileTop } from "./_components/nav-mobile-top"
import { NavMobileBottom } from "./_components/nav-mobile-bottom"
import { CommandPalette } from "@shared/ui/command-palette"
import { BottomSheet } from "@shared/ui/bottom-sheet"
import type { RecordRow } from "@/lib/types"

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
  const homeHref = "/"
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [captureSheetOpen, setCaptureSheetOpen] = useState(false)
  const [quickCaptureContent, setQuickCaptureContent] = useState("")

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

  const detectedQuickCaptureUrl = useMemo(() => {
    const match = quickCaptureContent.match(/https?:\/\/[^\s]+/i)
    return match?.[0] ?? null
  }, [quickCaptureContent])

  const quickCaptureMutation = useMutation({
    mutationFn: async () => {
      const trimmed = quickCaptureContent.trim()
      const isLink = Boolean(detectedQuickCaptureUrl) && trimmed === detectedQuickCaptureUrl

      return apiFetch<RecordRow>("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: isLink ? "link" : "note",
          content: trimmed,
          url: isLink ? detectedQuickCaptureUrl : undefined
        })
      })
    },
    onSuccess: () => {
      setQuickCaptureContent("")
      setCaptureSheetOpen(false)
    }
  })

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
        const target = event.target as HTMLElement | null
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return
        }
        event.preventDefault()
        setPaletteOpen(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])



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

      <NavMobileBottom
        pathname={pathname}
        captureSheetOpen={captureSheetOpen}
        onOpenCapture={() => setCaptureSheetOpen(true)}
      />

      <CommandPalette
        t={t}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        buildRecordHref={buildRecordHref}
      />

      <BottomSheet
        open={captureSheetOpen}
        title={t("capture.quickMode", "QUICK INPUT")}
        description={t("capture.contentPlaceholder", "Paste your content")}
        onClose={() => setCaptureSheetOpen(false)}
      >
        <div className="space-y-4">
          <textarea
            value={quickCaptureContent}
            onChange={(event) => setQuickCaptureContent(event.target.value)}
            rows={7}
            placeholder={t("capture.contentPlaceholder", "Paste your content")}
            className="w-full resize-y border-4 border-foreground bg-background p-4 text-base font-medium text-foreground focus:outline-none focus:ring-0"
          />
          {quickCaptureMutation.error ? (
            <p className="font-mono text-[10px] font-bold uppercase text-destructive">
              {quickCaptureMutation.error.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => quickCaptureMutation.mutate()}
              disabled={quickCaptureMutation.isPending || quickCaptureContent.trim().length === 0}
              className="min-h-[48px] border-4 border-foreground bg-foreground px-4 py-3 font-mono text-xs font-bold uppercase text-background shadow-brutal-sm transition-all hover:bg-accent hover:text-accent-foreground active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
            >
              {quickCaptureMutation.isPending ? t("capture.transmitting", "SAVING...") : t("capture.commit", "SAVE")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCaptureSheetOpen(false)
                router.push("/capture")
              }}
              className="min-h-[48px] border-4 border-foreground bg-background px-4 py-3 font-mono text-xs font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {t("capture.advancedMode", "ADVANCED OPTIONS")}
            </button>
          </div>
        </div>
      </BottomSheet>

      {authError ? <p className="font-mono text-xs text-destructive mt-[-1rem] mb-4">{authError}</p> : null}
    </>
  )
}
