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
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-background font-sans">
      <main className="max-w-5xl w-full mx-auto mt-8 md:mt-24 space-y-8 md:space-y-12 animate-fade-in-up">

        <header className="flex flex-col gap-6 md:gap-8 border-[3px] md:border-4 border-foreground p-6 md:p-8 bg-card shadow-brutal-sm md:shadow-brutal relative overflow-hidden group/hero">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none group-hover/hero:bg-accent/10 transition-colors duration-500" aria-hidden="true" />

          <div className="flex flex-wrap gap-2 relative z-10">
            <span className="bg-foreground text-background px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_rgba(255,255,255,0.2)] dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.8)] border border-transparent">{t("home.hero.tagDev", "For Developers")}</span>
            <span className="bg-foreground text-background px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_rgba(255,255,255,0.2)] dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.8)] border border-transparent">{t("home.hero.tagResearch", "For Researchers")}</span>
            <span className="bg-foreground text-background px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_rgba(255,255,255,0.2)] dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.8)] border border-transparent">{t("home.hero.tagBuild", "For Builders")}</span>
          </div>

          <h1 className="font-black text-5xl sm:text-6xl md:text-7xl tracking-tighter uppercase text-foreground leading-[0.9] break-words relative z-10">
            {t("home.hero.title", "INFRASTRUCTURE FOR")}<br />
            <span className="text-accent underline decoration-8 underline-offset-8">{t("home.hero.subtitle", "YOUR THINKING")}</span>
          </h1>

          <p className="font-sans text-lg md:text-xl font-bold max-w-3xl opacity-90 leading-relaxed border-l-[6px] border-accent pl-4 relative z-10 break-keep">
            {t("home.hero.desc", "Traditional note apps are warehouses where ideas go to die. REBAR is a powerful SSOT pipeline that keeps knowledge flowing, not collecting dust. Stop fragmented scraps — build a pipeline.")}
          </p>

          <div className="pt-2 relative z-10 flex flex-wrap gap-4">
            <Link href="/capture" className="bg-accent text-accent-foreground font-black text-lg md:text-xl uppercase px-8 py-4 border-4 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer">
              {t("home.hero.cta", "Initialize Pipeline")}
            </Link>
            <Link href="/review" className="bg-background text-foreground font-black text-lg md:text-xl uppercase px-8 py-4 border-4 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-2 cursor-pointer">
              <Terminal className="w-5 h-5" /> {t("home.hero.ctaSecondary", "View Workflow")}
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-[3px] md:border-4 border-foreground bg-foreground text-background shadow-brutal-sm">
          <div className="p-3 md:p-4 text-center border-b-[3px] lg:border-b-0 border-r-[3px] border-background/30 font-mono text-[10px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors hover:bg-background/10">
            <CheckSquare className="w-4 h-4 text-accent" /> {t("home.hero.feat1", "100% OWNERSHIP")}
          </div>
          <div className="p-3 md:p-4 text-center border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-background/30 font-mono text-[10px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors hover:bg-background/10">
            <Database className="w-4 h-4 text-accent" /> {t("home.hero.feat2", "NO VENDOR LOCK-IN")}
          </div>
          <div className="p-3 md:p-4 text-center border-r-[3px] border-background/30 font-mono text-[10px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors hover:bg-background/10">
            <Terminal className="w-4 h-4 text-accent" /> {t("home.hero.feat3", "AI-READY CONTEXT")}
          </div>
          <div className="p-3 md:p-4 text-center font-mono text-[10px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors hover:bg-background/10">
            <CheckSquare className="w-4 h-4 text-accent" /> {t("home.hero.feat4", "SSOT GUARANTEED")}
          </div>
        </div>

        <section className="flex flex-col gap-6 md:gap-8 lg:pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-[3px] md:border-4 border-foreground pb-4 md:p-4 bg-background">
            <div className="flex items-center gap-3 px-1 md:px-0">
              <span className="w-3 h-3 bg-accent animate-pulse-brutal" aria-hidden="true" />
              <h2 className="font-black text-3xl md:text-5xl tracking-tighter uppercase">
                {t("home.hero.pipelineTitle", "The Knowledge Pipeline")}
              </h2>
            </div>
            <p className="font-mono text-xs md:text-sm font-bold bg-foreground text-background px-3 py-1 uppercase border-l-4 border-accent inline-block self-start sm:self-auto ml-1 sm:ml-0 shadow-brutal-sm whitespace-nowrap">
              {t("home.hero.pipelineFlow", "Flow: Capture → Review → SSOT")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-[3px] md:border-4 border-foreground bg-card shadow-brutal-sm md:shadow-brutal">

            <div className="p-6 md:p-8 flex flex-col gap-5 border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-foreground hover:bg-foreground hover:text-background transition-colors group cursor-default">
              <div className="flex justify-between items-start">
                <span className="font-black text-6xl text-foreground/20 group-hover:text-background/20 transition-colors">01</span>
                <span className="border-2 border-foreground group-hover:border-background group-hover:bg-background group-hover:text-foreground px-2 py-1 font-mono text-[10px] md:text-xs font-bold uppercase transition-colors">{t("home.hero.step1Badge", "Extension")}</span>
              </div>
              <h3 className="font-black text-3xl uppercase">{t("home.hero.step1Title", "Capture")}</h3>
              <p className="font-sans text-[15px] md:text-base font-bold opacity-90 break-keep leading-relaxed border-t-2 border-foreground/20 group-hover:border-background/20 pt-4 mt-auto">
                {t("home.hero.step1Desc", "가장 무자비한 수집. 크롬 익스텐션을 통해 웹의 모든 텍스트, 아티클, 레퍼런스를 클릭 한 번으로 Inbox에 가둡니다.")}
              </p>
            </div>

            <div className="p-6 md:p-8 flex flex-col gap-5 border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-foreground hover:bg-foreground hover:text-background transition-colors group cursor-default">
              <div className="flex justify-between items-start">
                <span className="font-black text-6xl text-foreground/20 group-hover:text-background/20 transition-colors">02</span>
                <span className="border-2 border-foreground group-hover:border-background group-hover:bg-background group-hover:text-foreground px-2 py-1 font-mono text-[10px] md:text-xs font-bold uppercase transition-colors">{t("home.hero.step2Badge", "Routine")}</span>
              </div>
              <h3 className="font-black text-3xl uppercase">{t("home.hero.step2Title", "Review")}</h3>
              <p className="font-sans text-[15px] md:text-base font-bold opacity-90 break-keep leading-relaxed border-t-2 border-foreground/20 group-hover:border-background/20 pt-4 mt-auto">
                {t("home.hero.step2Desc", "노이즈 제거. 매일 할당된 분량의 데이터를 강제 리뷰하여 무가치한 것을 버리고 데이터에 핵심적인 맥락을 부여합니다.")}
              </p>
            </div>

            <div className="p-6 md:p-8 flex flex-col gap-5 bg-accent text-accent-foreground hover:bg-foreground hover:text-background transition-colors group cursor-default">
              <div className="flex justify-between items-start">
                <span className="font-black text-6xl text-background/30 group-hover:text-accent/30 transition-colors">03</span>
                <span className="border-2 border-background group-hover:border-accent group-hover:bg-accent group-hover:text-accent-foreground px-2 py-1 font-mono text-[10px] md:text-xs font-bold uppercase transition-colors shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] group-hover:shadow-none">SSOT</span>
              </div>
              <h3 className="font-black text-3xl uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)] group-hover:drop-shadow-none">{t("home.hero.step3Title", "Vault")}</h3>
              <p className="font-sans text-[15px] md:text-base font-bold break-keep leading-relaxed border-t-2 border-background/30 group-hover:border-accent/30 pt-4 mt-auto drop-shadow-[1px_1px_0_rgba(0,0,0,0.2)] group-hover:drop-shadow-none">
                {t("home.hero.step3Desc", "파이프라인 완성. 철저히 정제된 정보를 영구적인 단일 데이터베이스에 보관합니다. AI가 즉각 활용할 수 있는 인프라가 됩니다.")}
              </p>
            </div>

          </div>
        </section>

        {onboarding.show ? (
          <section className="border-[3px] md:border-4 border-foreground bg-card p-4 md:p-6 shadow-brutal-sm md:shadow-brutal transition-transform hover:-translate-y-1">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-2xl uppercase flex items-center gap-2">
                  <span className="bg-accent text-accent-foreground px-2 py-0.5 text-sm align-middle">NEW</span>
                  {t("home.onboarding.title", "2-MIN ONBOARDING")}
                </p>
                <p className="font-mono text-[11px] font-bold uppercase text-muted-foreground mt-1">
                  {t("home.onboarding.desc", "캡처 → 리뷰 → 인박스 정리까지 한 번에 완료")}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissOnboarding}
                className="min-h-[44px] border-2 border-transparent hover:border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-colors focus-ring"
              >
                {t("home.onboarding.dismiss", "닫기")}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {onboarding.steps.map((step) => (
                <div
                  key={step.key}
                  className={`min-h-[44px] border-2 px-3 py-2 font-mono text-xs font-bold uppercase transition-all ${step.done
                    ? "border-foreground bg-foreground text-background shadow-[inset_4px_4px_0_0_rgba(255,255,255,0.2)]"
                    : "border-foreground bg-background text-foreground"
                    }`}
                >
                  <span className="mr-2 inline-block font-black">{step.done ? "[X]" : "[ ]"}</span>
                  {step.label}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t-4 border-foreground pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-xs font-bold uppercase text-foreground bg-accent/20 px-2 py-1">
                {t("home.onboarding.progress", "진행률")}: {onboarding.doneCount}/{onboarding.total}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/capture"
                  className="min-h-[44px] border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-colors focus-ring inline-flex items-center justify-center shadow-brutal-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {t("home.onboarding.goCapture", "캡처 열기")}
                </Link>
                <Link
                  href="/review"
                  className="min-h-[44px] border-2 border-foreground bg-accent px-4 py-2 font-mono text-xs font-bold uppercase text-white hover:bg-foreground transition-colors focus-ring inline-flex items-center justify-center shadow-brutal-sm active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {t("home.onboarding.goReview", "리뷰 열기")}
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-6 md:pt-12">

          <Link
            href="/review"
            className="group relative block border-[3px] md:border-4 border-foreground bg-card p-5 md:p-8 hover:bg-accent hover:text-white transition-all duration-200 shadow-brutal-sm md:shadow-brutal active:translate-x-2 active:translate-y-2 active:shadow-none overflow-hidden"
          >
            <div className="absolute -right-[20%] -top-[20%] opacity-5 w-64 h-64 bg-foreground rounded-full blur-3xl group-hover:bg-white transition-all duration-500 pointer-events-none" aria-hidden="true" />
            <div className="flex justify-between items-start mb-8 relative z-10">
              <CheckSquare className="w-10 h-10 group-hover:animate-pulse" strokeWidth={2.5} />
              <span className="font-mono text-xs font-bold bg-foreground text-background px-2 py-1 border-2 border-transparent group-hover:border-white">{t("home.badge.review", "REVIEW")}</span>
            </div>
            <h2 className="font-black text-4xl sm:text-5xl uppercase mb-3 relative z-10 transition-transform group-hover:translate-x-1">{t("home.review.title", "Review")}</h2>
            <p className="font-mono text-sm opacity-80 uppercase font-bold mb-4 relative z-10">{t("home.review.desc", "Execute daily focus routine.")}</p>
            {remaining !== null && (
              <div className="flex items-center gap-3 mt-auto pt-4 border-t-4 border-current/30 relative z-10">
                <span className="font-mono text-3xl font-black">{remaining}</span>
                <span className="font-mono text-xs font-bold uppercase opacity-80">{t("home.review.remaining", "남은 리뷰")}</span>
                {streak !== null && streak > 0 && (
                  <span className="ml-auto font-mono text-xs font-bold uppercase border-2 border-current px-2 py-1">{streak}d 🔥</span>
                )}
              </div>
            )}
          </Link>

          <div className="flex flex-col gap-4 md:gap-6">
            <Link
              href="/capture"
              className="group relative flex-1 flex flex-col border-[3px] md:border-4 border-foreground bg-card p-5 md:p-6 hover:bg-foreground hover:text-background transition-all duration-200 shadow-brutal-sm md:shadow-brutal active:translate-x-1.5 active:translate-y-1.5 active:shadow-none overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6 relative z-10">
                <Terminal className="w-8 h-8 group-hover:text-accent transition-colors" strokeWidth={2.5} />
                <span className="font-mono text-xs font-bold border-2 border-current px-2 py-0.5 group-hover:border-accent group-hover:text-accent transition-colors">{t("home.badge.capture", "CAPTURE")}</span>
              </div>
              <h2 className="font-black text-3xl uppercase mt-auto relative z-10 transition-transform group-hover:translate-x-1">{t("home.capture.title", "Capture")}</h2>
            </Link>

            <Link
              href="/library"
              className="group relative flex-1 flex flex-col border-[3px] md:border-4 border-foreground bg-card p-5 md:p-6 hover:bg-foreground hover:text-background transition-all duration-200 shadow-brutal-sm md:shadow-brutal active:translate-x-1.5 active:translate-y-1.5 active:shadow-none overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6 relative z-10">
                <Database className="w-8 h-8 group-hover:text-accent transition-colors" strokeWidth={2.5} />
                <span className="font-mono text-xs font-bold border-2 border-current px-2 py-0.5 group-hover:border-accent group-hover:text-accent transition-colors">{t("home.badge.library", "LIBRARY")}</span>
              </div>
              <h2 className="font-black text-3xl uppercase mt-auto relative z-10 transition-transform group-hover:translate-x-1">{t("home.library.title", "Library")}</h2>
            </Link>
          </div>

        </div>
      </main>
    </div>
  )
}
