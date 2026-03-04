"use client"

import Link from "next/link"
import { BriefcaseBusiness } from "lucide-react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"

export default function ProjectsPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <AuthGate>
        <main className="max-w-4xl mx-auto animate-fade-in-up pb-24">
          <AppNav />

          <section className="mt-8 border-4 border-foreground bg-card p-6 md:p-8 shadow-brutal">
            <h1 className="font-black text-4xl uppercase text-foreground leading-none flex items-center gap-3">
              <BriefcaseBusiness className="w-9 h-9" strokeWidth={3} />
              {t("projects.title", "PROJECT MODE")}
            </h1>
            <p className="mt-4 font-mono text-sm font-bold uppercase text-muted-foreground">
              {t("projects.disabled", "PROJECT MODE IS TEMPORARILY DISABLED")}
            </p>
            <p className="mt-2 font-mono text-xs font-bold uppercase text-muted-foreground">
              {t("projects.disabledHint", "CORE CAPTURE/REVIEW/LIBRARY FLOW IS STILL AVAILABLE")}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/review"
                className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
              >
                {t("projects.gotoReview", "GO REVIEW")}
              </Link>
              <Link
                href="/library"
                className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
              >
                {t("projects.gotoLibrary", "GO LIBRARY")}
              </Link>
            </div>
          </section>
        </main>
      </AuthGate>
    </div>
  )
}
