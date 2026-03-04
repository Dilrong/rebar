"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "./_components/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { getStartPagePreference, setStartPagePreference, type StartPage } from "@feature-lib/settings/preferences"

type AccountInfo = {
  id: string | null
  email: string | null
  createdAt: string | null
}

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const [account, setAccount] = useState<AccountInfo>({ id: null, email: null, createdAt: null })
  const [startPage, setStartPage] = useState<StartPage>("/library")
  const [origin, setOrigin] = useState("http://localhost:3000")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase.auth.getUser().then(({ data }) => {
      setAccount({
        id: data.user?.id ?? null,
        email: data.user?.email ?? null,
        createdAt: data.user?.created_at ?? null
      })
    })

    setStartPage(getStartPagePreference())
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
      <ProtectedPageShell mainClassName="max-w-3xl">
        <header className="mb-8 border-b-4 border-foreground pb-4">
          <h1 className="font-black text-5xl uppercase text-foreground leading-none">{t("settings.title", "SETTINGS")}</h1>
        </header>

        <section className="mb-6 border-4 border-foreground bg-card p-5">
          <h2 className="mb-4 border-b-2 border-foreground pb-2 font-black text-2xl uppercase">{t("settings.account", "ACCOUNT")}</h2>
          <div className="space-y-2 font-mono text-sm">
            <p>
              <span className="font-bold">{t("settings.email", "Email")}: </span>
              {account.email ?? "-"}
            </p>
            <p>
              <span className="font-bold">{t("settings.joined", "Joined")}: </span>
              {account.createdAt ? new Date(account.createdAt).toLocaleString() : "-"}
            </p>
          </div>
        </section>

        <section className="border-4 border-foreground bg-card p-5">
          <h2 className="mb-4 border-b-2 border-foreground pb-2 font-black text-2xl uppercase">{t("settings.language", "LANGUAGE")}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale("ko")}
              className={
                locale === "ko"
                  ? "min-h-[44px] border-2 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold text-background"
                  : "min-h-[44px] border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold text-foreground"
              }
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={
                locale === "en"
                  ? "min-h-[44px] border-2 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold text-background"
                  : "min-h-[44px] border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold text-foreground"
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
          <select
            value={startPage}
            onChange={(event) => {
              const next = event.target.value as StartPage
              setStartPage(next)
              setStartPagePreference(next)
            }}
            className="w-full border-2 border-foreground bg-background p-3 font-mono text-xs font-bold uppercase text-foreground"
          >
            <option value="/review">{t("settings.start.review", "Review")}</option>
            <option value="/capture">{t("settings.start.capture", "Capture")}</option>
            <option value="/library">{t("settings.start.library", "Vault")}</option>
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
            className="mb-3 inline-block border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase text-foreground"
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
            className="mt-3 border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background"
          >
            {copied ? t("settings.agent.copied", "COPIED") : t("settings.agent.copy", "COPY CURL")}
          </button>
        </section>
      </ProtectedPageShell>
    </AuthGate>
  )
}
