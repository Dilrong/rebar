"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "./_components/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import {
  getStartPagePreference,
  getFontFamilyPreference,
  getPreferencesServer,
  setStartPagePreference,
  setFontFamilyPreference,
  setPreferencesServer,
  type StartPage,
  type FontFamily
} from "@feature-lib/settings/preferences"

type AccountInfo = {
  id: string | null
  email: string | null
  createdAt: string | null
}

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const [account, setAccount] = useState<AccountInfo>({ id: null, email: null, createdAt: null })
  const [startPage, setStartPage] = useState<StartPage>("/library")
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans")
  const [origin, setOrigin] = useState("http://localhost:3000")
  const [copied, setCopied] = useState(false)
  const [pendingLogout, setPendingLogout] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setPendingLogout(true)
    setAuthError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.auth.signOut()
      if (error) setAuthError(error.message)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Logout failed")
    } finally {
      setPendingLogout(false)
    }
  }

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase.auth.getUser().then(({ data }) => {
      setAccount({
        id: data.user?.id ?? null,
        email: data.user?.email ?? null,
        createdAt: data.user?.created_at ?? null
      })
    })

    const localStartPage = getStartPagePreference()
    const localFontFamily = getFontFamilyPreference()
    setStartPage(localStartPage)
    setFontFamily(localFontFamily)

    void getPreferencesServer().then((serverPrefs) => {
      if (serverPrefs.startPage) {
        setStartPage(serverPrefs.startPage)
        setStartPagePreference(serverPrefs.startPage)
      }
      if (serverPrefs.fontFamily) {
        setFontFamily(serverPrefs.fontFamily)
        setFontFamilyPreference(serverPrefs.fontFamily)
        document.documentElement.setAttribute("data-font", serverPrefs.fontFamily)
      }
    })
    setOrigin(window.location.origin)
  }, [])

  const agentCurl = `curl -X POST "${origin}/api/capture/ingest" \\
  -H "x-rebar-ingest-key: <REBAR_INGEST_API_KEY>" \\
  -H "x-user-id: ${account.id ?? "<USER_UUID>"}" \\
  -H "content-type: application/json" \\
  -d '{
    "items": [
      {
        "content": "example highlight",
        "title": "example source",
        "url": "https://example.com",
        "tags": ["readwise", "agent"]
      }
    ]
  }'`

  return (
    <AuthGate>
      <ProtectedPageShell mainClassName="max-w-5xl">
        <header className="mb-8 border-b-4 border-foreground pb-4">
          <h1 className="font-black text-3xl uppercase text-foreground leading-none md:text-5xl">{t("settings.title", "SETTINGS")}</h1>
        </header>

        <section className="mb-6 border-4 border-foreground bg-card p-5">
          <h2 className="mb-4 border-b-2 border-foreground pb-2 font-black text-2xl uppercase">{t("settings.account", "ACCOUNT")}</h2>
          <div className="space-y-2 font-mono text-sm mb-4">
            <p>
              <span className="font-bold">{t("settings.email", "Email")}: </span>
              {account.email ?? "-"}
            </p>
            <p>
              <span className="font-bold">{t("settings.joined", "Joined")}: </span>
              {account.createdAt ? new Date(account.createdAt).toLocaleString() : "-"}
            </p>
          </div>
          {authError && <p className="mb-2 font-mono text-xs font-bold text-destructive">{authError}</p>}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={pendingLogout}
            className="min-h-[44px] w-full border-4 border-destructive bg-background px-4 py-2 font-mono text-xs font-bold uppercase text-destructive shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-destructive hover:text-destructive-foreground sm:w-auto"
          >
            {pendingLogout ? "LOGGING OUT..." : t("nav.logout", "LOGOUT")}
          </button>
        </section>

        <section className="mb-6 border-4 border-foreground bg-card p-5">
          <h2 className="mb-4 border-b-2 border-foreground pb-2 font-black text-2xl uppercase">{t("settings.typography", "TYPOGRAPHY")}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setFontFamily("sans")
                setFontFamilyPreference("sans")
                document.documentElement.setAttribute("data-font", "sans")
                void setPreferencesServer({ fontFamily: "sans" })
              }}
              className={
                fontFamily === "sans"
                  ? "min-h-[44px] w-full border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold text-background transition-transform active:translate-y-[2px] active:translate-x-[2px]"
                  : "min-h-[44px] w-full border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold text-foreground shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background"
              }
            >
              SANS-SERIF
            </button>
            <button
              type="button"
              onClick={() => {
                setFontFamily("mono")
                setFontFamilyPreference("mono")
                document.documentElement.setAttribute("data-font", "mono")
                void setPreferencesServer({ fontFamily: "mono" })
              }}
              className={
                fontFamily === "mono"
                  ? "min-h-[44px] w-full border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold text-background transition-transform active:translate-y-[2px] active:translate-x-[2px]"
                  : "min-h-[44px] w-full border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold text-foreground shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background"
              }
            >
              MONOSPACE
            </button>
          </div>
          <p className="mt-3 font-mono text-xs font-bold text-muted-foreground">
            {t("settings.typographyDesc", "Select primary interface font style (Readable vs Brutalist)")}
          </p>
        </section>

        <section className="border-4 border-foreground bg-card p-5">
          <h2 className="mb-4 border-b-2 border-foreground pb-2 font-black text-2xl uppercase">{t("settings.language", "LANGUAGE")}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setLocale("ko")}
              className={
                locale === "ko"
                  ? "min-h-[44px] w-full border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold text-background transition-transform active:translate-y-[2px] active:translate-x-[2px]"
                  : "min-h-[44px] w-full border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold text-foreground shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background"
              }
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={
                locale === "en"
                  ? "min-h-[44px] w-full border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold text-background transition-transform active:translate-y-[2px] active:translate-x-[2px]"
                  : "min-h-[44px] w-full border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold text-foreground shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background"
              }
            >
              English
            </button>
          </div>
          <p className="mt-3 font-mono text-xs font-bold text-muted-foreground">
            {t("settings.languagePreview", "Preview")}: {t("capture.title", "CAPTURE")} / {t("review.workload", "TODAY'S REVIEW")}
          </p>
        </section>

        <section className="mt-6 border-4 border-foreground bg-card p-5">
          <h2 className="mb-4 border-b-2 border-foreground pb-2 font-black text-2xl uppercase">{t("settings.startPage", "START PAGE")}</h2>
          <label htmlFor="settings-start-page" className="sr-only">
            {t("settings.startPage", "START PAGE")}
          </label>
          <select
            id="settings-start-page"
            value={startPage}
            onChange={(event) => {
              const next = event.target.value as StartPage
              setStartPage(next)
              setStartPagePreference(next)
              void setPreferencesServer({ startPage: next })
            }}
            className="w-full min-h-[44px] border-4 border-foreground bg-background p-3 font-mono text-xs font-bold uppercase text-foreground focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] rounded-none"
          >
            <option value="/review">{t("settings.start.review", "Review")}</option>
            <option value="/capture">{t("settings.start.capture", "Capture")}</option>
            <option value="/library">{t("settings.start.library", "Library")}</option>
            <option value="/search">{t("settings.start.search", "Search")}</option>
          </select>
          <p className="mt-3 font-mono text-xs font-bold text-muted-foreground">{t("settings.startHint", "Applies to the REBAR_ logo link.")}</p>
        </section>

        <section className="mt-6 border-4 border-foreground bg-card p-5">
          <h2 className="mb-4 border-b-2 border-foreground pb-2 font-black text-2xl uppercase">{t("settings.agent.title", "AGENT INTEGRATION")}</h2>
          <p className="mb-2 font-mono text-xs text-muted-foreground">
            {t("settings.agent.desc", "Use this template for OpenClaw or external agents to send captures.")}
          </p>
          <Link
            href="/api/capture/guide"
            target="_blank"
            className="mb-3 inline-flex min-h-[44px] w-full items-center justify-center border-2 border-foreground bg-background px-3 py-1 font-mono text-xs font-bold uppercase text-foreground shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background sm:w-auto"
          >
            {t("settings.agent.guide", "OPEN JSON GUIDE")}
          </Link>
          <pre className="overflow-x-auto border-2 border-foreground bg-background p-3 font-mono text-[10px] leading-5 text-foreground">
            {agentCurl}
          </pre>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(agentCurl)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
            className="mt-3 min-h-[44px] w-full border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold uppercase text-background shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-background hover:text-foreground sm:w-auto"
          >
            {copied ? t("settings.agent.copied", "COPIED") : t("settings.agent.copy", "COPY CURL")}
          </button>
        </section>
      </ProtectedPageShell>
    </AuthGate>
  )
}
