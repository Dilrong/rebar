"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, Copy, Globe, Languages, LogOut, Type, UserRound } from "lucide-react"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"
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

function optionCardClass(active: boolean) {
  return cn(
    "group flex min-h-[136px] flex-col justify-between border-[3px] p-4 text-left transition-all duration-200 md:border-4",
    active
      ? "border-foreground bg-foreground text-background shadow-brutal-sm md:shadow-brutal"
      : "border-foreground bg-background text-foreground shadow-brutal-sm hover:-translate-x-1 hover:-translate-y-1 hover:bg-accent/10"
  )
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
  const joinedAtLabel = account.createdAt ? new Date(account.createdAt).toLocaleString() : "-"

  const fontOptions: Array<{ value: FontFamily; title: string; description: string }> = [
    {
      value: "sans",
      title: "SANS-SERIF",
      description: t("settings.typography.sansDesc", "Cleaner reading rhythm for daily capture and review")
    },
    {
      value: "mono",
      title: "MONOSPACE",
      description: t("settings.typography.monoDesc", "Sharper operator feel with a denser brutalist tone")
    }
  ]

  const languageOptions = [
    {
      value: "ko" as const,
      title: "KOREAN",
      label: "한국어",
      preview: t("settings.languageKoPreview", "캡처, 리뷰, 라이브러리 흐름에 최적화")
    },
    {
      value: "en" as const,
      title: "ENGLISH",
      label: "English",
      preview: t("settings.languageEnPreview", "Optimized for capture, review, and library workflows")
    }
  ]

  const startPageOptions: Array<{ value: StartPage; title: string; description: string }> = [
    {
      value: "/review",
      title: t("settings.start.review", "Review"),
      description: t("settings.start.reviewDesc", "Open the daily decision loop first")
    },
    {
      value: "/capture",
      title: t("settings.start.capture", "Capture"),
      description: t("settings.start.captureDesc", "Jump directly into inbox creation")
    },
    {
      value: "/library",
      title: t("settings.start.library", "Library"),
      description: t("settings.start.libraryDesc", "Land in the vault management surface")
    },
    {
      value: "/search",
      title: t("settings.start.search", "Search"),
      description: t("settings.start.searchDesc", "Start from retrieval and lookup")
    }
  ]

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
      <ProtectedPageShell rootClassName="selection:bg-accent selection:text-white md:p-6" mainClassName="max-w-6xl pb-24">
        <header className="relative mb-8 overflow-hidden border-[3px] border-foreground bg-card p-5 shadow-brutal-sm md:mb-10 md:border-4 md:p-8 md:shadow-brutal">
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 bg-accent opacity-20 [clip-path:polygon(100%_0,0_0,100%_100%)] md:h-32 md:w-32" aria-hidden="true" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="w-fit border-2 border-foreground bg-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-background md:text-xs">
                {t("settings.kicker", "SYSTEM PREFERENCES")}
              </p>
              <h1 className="text-4xl font-black uppercase leading-none text-foreground md:text-6xl">{t("settings.title", "SETTINGS")}</h1>
              <p className="border-l-4 border-accent pl-4 font-sans text-sm font-bold leading-relaxed text-foreground/80 md:text-base">
                {t("settings.subtitle", "Tune the operator surface for capture, review, and vault workflows without leaving the REBAR_ system language.")}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="border-2 border-foreground bg-background px-3 py-3 shadow-brutal-sm">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{t("settings.hero.account", "ACCOUNT")}</p>
                <p className="mt-2 truncate font-mono text-xs font-bold uppercase text-foreground">{account.email ?? "-"}</p>
              </div>
              <div className="border-2 border-foreground bg-background px-3 py-3 shadow-brutal-sm">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{t("settings.hero.language", "LANGUAGE")}</p>
                <p className="mt-2 font-mono text-xs font-bold uppercase text-foreground">{locale === "ko" ? "KOREAN" : "ENGLISH"}</p>
              </div>
              <div className="border-2 border-foreground bg-background px-3 py-3 shadow-brutal-sm">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{t("settings.hero.startPage", "START PAGE")}</p>
                <p className="mt-2 font-mono text-xs font-bold uppercase text-foreground">{startPage.replace("/", "") || "HOME"}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="border-[3px] border-foreground bg-card p-5 shadow-brutal-sm md:border-4 md:p-6 md:shadow-brutal">
            <div className="mb-6 flex items-start justify-between gap-4 border-b-[3px] border-foreground pb-4 md:border-b-4 md:pb-5">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">01 / {t("settings.account", "ACCOUNT")}</p>
                <h2 className="mt-2 text-2xl font-black uppercase md:text-4xl">{t("settings.accountTitle", "Operator Identity")}</h2>
              </div>
              <UserRound className="h-8 w-8 text-accent md:h-10 md:w-10" strokeWidth={2.5} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="border-2 border-foreground bg-background p-4 shadow-brutal-sm">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{t("settings.email", "Email")}</p>
                <p className="mt-3 break-all font-mono text-xs font-bold text-foreground">{account.email ?? "-"}</p>
              </div>
              <div className="border-2 border-foreground bg-background p-4 shadow-brutal-sm">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{t("settings.joined", "Joined")}</p>
                <p className="mt-3 font-mono text-xs font-bold text-foreground">{joinedAtLabel}</p>
              </div>
              <div className="border-2 border-foreground bg-background p-4 shadow-brutal-sm">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{t("settings.origin", "Origin")}</p>
                <p className="mt-3 break-all font-mono text-xs font-bold text-foreground">{origin}</p>
              </div>
            </div>
            {authError ? <p className="mt-4 font-mono text-xs font-bold uppercase text-destructive">{authError}</p> : null}
          </div>

          <div className="border-[3px] border-foreground bg-foreground p-5 text-background shadow-brutal-sm md:border-4 md:p-6 md:shadow-brutal">
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-background/30 pb-4 md:border-b-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-background/70">02 / {t("settings.security", "SESSION")}</p>
                <h2 className="mt-2 text-2xl font-black uppercase md:text-4xl">{t("settings.logoutTitle", "Access Control")}</h2>
              </div>
              <LogOut className="h-8 w-8 text-accent md:h-10 md:w-10" strokeWidth={2.5} />
            </div>
            <p className="mt-5 max-w-none font-sans text-sm font-bold leading-relaxed text-background/80">
              {t("settings.logoutDesc", "Sign out this operator session while keeping the rest of the vault untouched.")}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={pendingLogout}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 border-[3px] border-destructive bg-background px-4 py-3 font-mono text-xs font-bold uppercase text-destructive shadow-[4px_4px_0_0_rgba(255,255,255,0.15)] transition-all hover:bg-destructive hover:text-destructive-foreground active:translate-x-1 active:translate-y-1 active:shadow-none md:border-4"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.5} />
              {pendingLogout ? "LOGGING OUT..." : t("nav.logout", "LOGOUT")}
            </button>
          </div>
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-2">
          <div className="border-[3px] border-foreground bg-card p-5 shadow-brutal-sm md:border-4 md:p-6 md:shadow-brutal">
            <div className="mb-6 flex items-start justify-between gap-4 border-b-[3px] border-foreground pb-4 md:border-b-4 md:pb-5">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">03 / {t("settings.typography", "TYPOGRAPHY")}</p>
                <h2 className="mt-2 text-2xl font-black uppercase md:text-4xl">{t("settings.typographyTitle", "Reading Tone")}</h2>
              </div>
              <Type className="h-8 w-8 text-accent md:h-10 md:w-10" strokeWidth={2.5} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fontOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFontFamily(option.value)
                    setFontFamilyPreference(option.value)
                    document.documentElement.setAttribute("data-font", option.value)
                    void setPreferencesServer({ fontFamily: option.value })
                  }}
                  className={optionCardClass(fontFamily === option.value)}
                  aria-pressed={fontFamily === option.value}
                >
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-current/70">{fontFamily === option.value ? "ACTIVE" : "OPTION"}</p>
                    <p className="mt-3 font-mono text-sm font-black uppercase">{option.title}</p>
                  </div>
                  <p className="mt-4 max-w-none font-sans text-sm font-bold leading-relaxed text-current/80">{option.description}</p>
                </button>
              ))}
            </div>
            <p className="mt-4 font-mono text-xs font-bold uppercase text-muted-foreground">
              {t("settings.typographyDesc", "Select primary interface font style (Readable vs Brutalist)")}
            </p>
          </div>

          <div className="border-[3px] border-foreground bg-card p-5 shadow-brutal-sm md:border-4 md:p-6 md:shadow-brutal">
            <div className="mb-6 flex items-start justify-between gap-4 border-b-[3px] border-foreground pb-4 md:border-b-4 md:pb-5">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">04 / {t("settings.language", "LANGUAGE")}</p>
                <h2 className="mt-2 text-2xl font-black uppercase md:text-4xl">{t("settings.languageTitle", "Interface Locale")}</h2>
              </div>
              <Languages className="h-8 w-8 text-accent md:h-10 md:w-10" strokeWidth={2.5} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {languageOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLocale(option.value)}
                  className={optionCardClass(locale === option.value)}
                  aria-pressed={locale === option.value}
                >
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-current/70">{locale === option.value ? "ACTIVE" : option.title}</p>
                    <p
                      className="mt-3 font-sans text-lg font-black"
                      style={option.value === "ko" ? { fontFamily: "var(--font-korean), var(--app-font), sans-serif" } : undefined}
                    >
                      {option.label}
                    </p>
                  </div>
                  <p
                    className="mt-4 max-w-none font-sans text-sm font-bold leading-relaxed text-current/80"
                    style={option.value === "ko" ? { fontFamily: "var(--font-korean), var(--app-font), sans-serif" } : undefined}
                  >
                    {option.preview}
                  </p>
                </button>
              ))}
            </div>
            <p className="mt-4 font-mono text-xs font-bold uppercase text-muted-foreground">
              {t("settings.languagePreview", "Preview")}: {t("capture.title", "CAPTURE")} / {t("review.workload", "TODAY'S REVIEW")}
            </p>
          </div>
        </section>

        <section className="mb-6 border-[3px] border-foreground bg-card p-5 shadow-brutal-sm md:border-4 md:p-6 md:shadow-brutal">
          <div className="mb-6 flex items-start justify-between gap-4 border-b-[3px] border-foreground pb-4 md:border-b-4 md:pb-5">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">05 / {t("settings.startPage", "START PAGE")}</p>
              <h2 className="mt-2 text-2xl font-black uppercase md:text-4xl">{t("settings.startPageTitle", "Entry Surface")}</h2>
            </div>
            <Globe className="h-8 w-8 text-accent md:h-10 md:w-10" strokeWidth={2.5} />
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            {startPageOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStartPage(option.value)
                  setStartPagePreference(option.value)
                  void setPreferencesServer({ startPage: option.value })
                }}
                className={optionCardClass(startPage === option.value)}
                aria-pressed={startPage === option.value}
              >
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-current/70">{startPage === option.value ? "DEFAULT" : "ROUTE"}</p>
                  <p className="mt-3 font-mono text-sm font-black uppercase">{option.title}</p>
                </div>
                <p className="mt-4 max-w-none font-sans text-sm font-bold leading-relaxed text-current/80">{option.description}</p>
              </button>
            ))}
          </div>
          <p className="mt-4 font-mono text-xs font-bold uppercase text-muted-foreground">{t("settings.startHint", "Applies to the REBAR_ logo link.")}</p>
        </section>

        <section className="border-[3px] border-foreground bg-card p-5 shadow-brutal-sm md:border-4 md:p-6 md:shadow-brutal">
          <div className="mb-6 flex items-start justify-between gap-4 border-b-[3px] border-foreground pb-4 md:border-b-4 md:pb-5">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">06 / {t("settings.agent.title", "AGENT INTEGRATION")}</p>
              <h2 className="mt-2 text-2xl font-black uppercase md:text-4xl">{t("settings.agentHeading", "External Capture Handshake")}</h2>
            </div>
            <Bot className="h-8 w-8 text-accent md:h-10 md:w-10" strokeWidth={2.5} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <p className="max-w-none border-l-4 border-accent pl-4 font-sans text-sm font-bold leading-relaxed text-foreground/80">
                {t("settings.agent.desc", "Use this template for OpenClaw or external agents to send captures.")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="border-2 border-foreground bg-background p-4 shadow-brutal-sm">
                  <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">ENDPOINT</p>
                  <p className="mt-3 break-all font-mono text-xs font-bold text-foreground">{origin}/api/capture/ingest</p>
                </div>
                <div className="border-2 border-foreground bg-background p-4 shadow-brutal-sm">
                  <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">USER ID</p>
                  <p className="mt-3 break-all font-mono text-xs font-bold text-foreground">{account.id ?? "<USER_UUID>"}</p>
                </div>
              </div>
              <Link
                href="/api/capture/guide"
                target="_blank"
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 border-[3px] border-foreground bg-background px-4 py-3 font-mono text-xs font-bold uppercase text-foreground shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none md:border-4 sm:w-auto"
              >
                <Bot className="h-4 w-4" strokeWidth={2.5} />
                {t("settings.agent.guide", "OPEN JSON GUIDE")}
              </Link>
            </div>
            <div className="border-[3px] border-foreground bg-background p-3 shadow-brutal-sm md:border-4 md:p-4">
              <pre className="overflow-x-auto border-2 border-foreground bg-card p-3 font-mono text-[10px] leading-5 text-foreground md:p-4">
                {agentCurl}
              </pre>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(agentCurl)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1500)
                }}
                className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 border-[3px] border-foreground bg-foreground px-4 py-3 font-mono text-xs font-bold uppercase text-background shadow-brutal-sm transition-all hover:bg-accent hover:text-accent-foreground active:translate-x-1 active:translate-y-1 active:shadow-none md:border-4 sm:w-auto"
              >
                <Copy className="h-4 w-4" strokeWidth={2.5} />
                {copied ? t("settings.agent.copied", "COPIED") : t("settings.agent.copy", "COPY CURL")}
              </button>
            </div>
          </div>
        </section>
      </ProtectedPageShell>
    </AuthGate>
  )
}
