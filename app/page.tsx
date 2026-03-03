"use client"

import Link from "next/link"
import { Terminal, Database, CheckSquare } from "lucide-react"
import { useI18n } from "@/components/i18n/i18n-provider"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"

type ReviewStatsResponse = {
  today_reviewed: number
  today_remaining: number
  streak_days: number
  total_active: number
  total_records: number
}

export default function HomePage() {
  const { t } = useI18n()

  const stats = useQuery({
    queryKey: ["review-stats-home"],
    queryFn: () => apiFetch<ReviewStatsResponse>("/api/review/stats"),
    staleTime: 1000 * 60, // 1 minute
    retry: false
  })

  const remaining = stats.data?.today_remaining ?? null
  const streak = stats.data?.streak_days ?? null

  return (
    <div className="min-h-screen flex flex-col p-6 bg-background font-sans">
      <main className="max-w-4xl w-full mx-auto mt-16 md:mt-24 space-y-12 animate-fade-in-up">

        <header className="space-y-6 border-l-8 border-accent pl-6 py-2">
          <h1 className="font-black text-5xl sm:text-6xl md:text-8xl tracking-tighter uppercase text-foreground leading-[0.9] break-words">
            {t("home.title.line1", "DATA")}<br />{t("home.title.line2", "INFRASTRUCTURE")}.
          </h1>
          <p className="text-xl md:text-2xl font-mono text-muted-foreground uppercase tracking-wider font-bold max-w-2xl bg-foreground text-background inline-block px-3 py-1">
            {t("home.subtitle", "SSOT // SYSTEM.READY")}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12">

          <Link
            href="/review"
            className="group block border-4 border-foreground bg-card p-6 md:p-8 hover:bg-accent hover:text-white transition-colors shadow-brutal active:translate-x-2 active:translate-y-2 active:shadow-none"
          >
            <div className="flex justify-between items-start mb-8">
              <CheckSquare className="w-10 h-10 group-hover:animate-pulse" strokeWidth={2.5} />
              <span className="font-mono text-xs font-bold bg-foreground text-background px-2 py-1">{t("home.badge.review", "REVIEW")}</span>
            </div>
            <h2 className="font-black text-4xl uppercase mb-3">{t("home.review.title", "Review")}</h2>
            <p className="font-mono text-sm opacity-80 uppercase font-bold mb-4">{t("home.review.desc", "Execute daily focus routine.")}</p>
            {remaining !== null && (
              <div className="flex items-center gap-3 mt-auto pt-4 border-t-2 border-current/30">
                <span className="font-mono text-2xl font-black">{remaining}</span>
                <span className="font-mono text-xs font-bold uppercase opacity-80">{t("home.review.remaining", "남은 리뷰")}</span>
                {streak !== null && streak > 0 && (
                  <span className="ml-auto font-mono text-xs font-bold uppercase bg-current/10 px-2 py-1">{streak}d 🔥</span>
                )}
              </div>
            )}
          </Link>

          <div className="flex flex-col gap-6">
            <Link
              href="/capture"
              className="group flex-1 flex flex-col border-4 border-foreground bg-card p-6 hover:bg-foreground hover:text-background transition-colors shadow-brutal active:translate-x-1.5 active:translate-y-1.5 active:shadow-none"
            >
              <div className="flex justify-between items-start mb-6">
                <Terminal className="w-8 h-8" strokeWidth={2.5} />
                <span className="font-mono text-xs font-bold border-2 border-current px-2 py-0.5">{t("home.badge.capture", "CAPTURE")}</span>
              </div>
              <h2 className="font-black text-2xl uppercase mt-auto">{t("home.capture.title", "Capture")}</h2>
            </Link>

            <Link
              href="/library"
              className="group flex-1 flex flex-col border-4 border-foreground bg-card p-6 hover:bg-foreground hover:text-background transition-colors shadow-brutal active:translate-x-1.5 active:translate-y-1.5 active:shadow-none"
            >
              <div className="flex justify-between items-start mb-6">
                <Database className="w-8 h-8" strokeWidth={2.5} />
                <span className="font-mono text-xs font-bold border-2 border-current px-2 py-0.5">{t("home.badge.library", "LIBRARY")}</span>
              </div>
              <h2 className="font-black text-2xl uppercase mt-auto">{t("home.library.title", "Vault")}</h2>
            </Link>
          </div>

        </div>
      </main>
    </div>
  )
}
