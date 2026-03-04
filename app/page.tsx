"use client"

import Link from "next/link"
import { Terminal, Database, CheckSquare } from "lucide-react"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import { useEffect, useMemo, useState } from "react"

type ReviewStatsResponse = {
  today_reviewed: number
  today_remaining: number
  streak_days: number
  total_active: number
  total_records: number
}

type ReviewHistoryResponse = {
  data: Array<{ id: string }>
}

type RecordsResponse = {
  total: number
}

const ONBOARDING_DISMISS_KEY = "rebar.onboarding.dismissed"

export default function HomePage() {
  const { t } = useI18n()
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setOnboardingDismissed(window.localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1")
  }, [])

  const stats = useQuery({
    queryKey: ["review-stats-home"],
    queryFn: () => apiFetch<ReviewStatsResponse>("/api/review/stats"),
    staleTime: 1000 * 60, // 1 minute
    retry: false
  })

  const reviewHistory = useQuery({
    queryKey: ["review-history-onboarding"],
    queryFn: () => apiFetch<ReviewHistoryResponse>("/api/review/history?limit=1"),
    staleTime: 1000 * 60,
    retry: false,
    enabled: stats.isSuccess && (stats.data?.total_records ?? 0) > 0
  })

  const inbox = useQuery({
    queryKey: ["inbox-count-onboarding"],
    queryFn: () => apiFetch<RecordsResponse>("/api/records?state=INBOX&limit=1"),
    staleTime: 1000 * 30,
    retry: false,
    enabled: stats.isSuccess && (stats.data?.total_records ?? 0) > 0
  })

  const remaining = stats.data?.today_remaining ?? null
  const streak = stats.data?.streak_days ?? null

  const onboarding = useMemo(() => {
    const hasCapture = (stats.data?.total_records ?? 0) > 0
    const hasReview = (reviewHistory.data?.data.length ?? 0) > 0
    const inboxRemaining = inbox.data?.total
    const inboxClear = hasCapture && inboxRemaining === 0

    const steps = [
      { key: "capture", done: hasCapture, label: t("home.onboarding.stepCapture", "첫 캡처 1건 저장") },
      { key: "review", done: hasReview, label: t("home.onboarding.stepReview", "첫 리뷰 1회 처리") },
      {
        key: "inbox",
        done: inboxClear,
        label: t("home.onboarding.stepInbox", "INBOX 0개 만들기")
      }
    ]

    const doneCount = steps.filter((step) => step.done).length
    const show = stats.isSuccess && !onboardingDismissed && doneCount < steps.length

    return {
      show,
      steps,
      doneCount,
      total: steps.length
    }
  }, [inbox.data?.total, onboardingDismissed, reviewHistory.data?.data.length, stats.data?.total_records, stats.isSuccess, t])

  const dismissOnboarding = () => {
    setOnboardingDismissed(true)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_DISMISS_KEY, "1")
    }
  }

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

        {onboarding.show ? (
          <section className="border-4 border-foreground bg-card p-5 md:p-6 shadow-brutal">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-2xl uppercase">{t("home.onboarding.title", "2-MIN ONBOARDING")}</p>
                <p className="font-mono text-[11px] font-bold uppercase text-muted-foreground">
                  {t("home.onboarding.desc", "캡처 → 리뷰 → 인박스 정리까지 한 번에 완료")}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissOnboarding}
                className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
              >
                {t("home.onboarding.dismiss", "닫기")}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {onboarding.steps.map((step) => (
                <div
                  key={step.key}
                  className={`min-h-[44px] border-2 px-3 py-2 font-mono text-xs font-bold uppercase ${
                    step.done
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground bg-background text-foreground"
                  }`}
                >
                  <span className="mr-2">{step.done ? "[x]" : "[ ]"}</span>
                  {step.label}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t-2 border-foreground pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-xs font-bold uppercase text-muted-foreground">
                {t("home.onboarding.progress", "진행률")}: {onboarding.doneCount}/{onboarding.total}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/capture"
                  className="min-h-[44px] border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
                >
                  {t("home.onboarding.goCapture", "캡처 열기")}
                </Link>
                <Link
                  href="/review"
                  className="min-h-[44px] border-2 border-foreground bg-accent px-4 py-2 font-mono text-xs font-bold uppercase text-white hover:bg-foreground"
                >
                  {t("home.onboarding.goReview", "리뷰 열기")}
                </Link>
              </div>
            </div>
          </section>
        ) : null}

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
