"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { useI18n } from "@/components/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { RecordRow } from "@/lib/types"
import { Check, RefreshCcw } from "lucide-react"
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading"

type ReviewTodayResponse = {
  data: RecordRow[]
  total: number
}

export default function ReviewPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const today = useQuery({
    queryKey: ["review-today"],
    queryFn: () => apiFetch<ReviewTodayResponse>("/api/review/today?n=20")
  })

  const mutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "reviewed" | "resurface" }) =>
      apiFetch<{ record: RecordRow }>(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["review-today"] })
  })

  const first = today.data?.data[0]
  const nextQueue = today.data?.data.slice(1, 6) ?? []

  return (
    <div className="min-h-screen p-6 bg-background flex flex-col font-sans">
      <AuthGate>
        <main className="max-w-3xl w-full mx-auto flex-1 flex flex-col animate-fade-in-up">
          <AppNav />

          <div className="flex items-center justify-between mb-8 border-4 border-foreground bg-card p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
            <span className="font-mono text-sm font-bold tracking-widest uppercase text-foreground">
              {t("review.workload", "TODAY'S REVIEW")}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/review/history"
                className="font-mono text-xs font-bold uppercase border-2 border-foreground px-2 py-1 bg-background hover:bg-foreground hover:text-background"
              >
                {t("review.history", "HISTORY")}
              </Link>
              <div className="font-mono text-sm font-bold bg-foreground text-background px-2 py-1">
                {t("review.remaining", "REMAINING")}: {today.data?.total || 0}
              </div>
            </div>
          </div>

          {today.isLoading && (
            <div className="flex-1 flex justify-center mt-32">
              <div className="flex flex-col items-center gap-4 font-mono font-bold text-muted-foreground uppercase">
                <LoadingSpinner className="w-10 h-10 text-accent" />
                <span>{t("review.fetching", "Fetching blocks...")}</span>
              </div>
            </div>
          )}

          {today.isSuccess && !first && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in-up pb-24 border-4 border-dashed border-border mt-12 p-12 bg-muted/20">
              <h2 className="font-black text-4xl uppercase text-muted-foreground mb-4">{t("review.empty", "ALL CAUGHT UP")}</h2>
              <p className="font-mono text-sm font-bold text-muted-foreground/70 uppercase">{t("review.noPending", "No pending operations.")}</p>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href="/capture"
                  className="border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background"
                >
                  {t("review.goCapture", "Add new item")}
                </Link>
                <Link
                  href="/review/history"
                  className="border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-foreground"
                >
                  {t("review.history", "HISTORY")}
                </Link>
              </div>
            </div>
          )}

          {first && (
            <div className="flex-1 flex flex-col relative w-full border-4 border-foreground bg-card shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] p-6 md:p-10" key={first.id}>
              <div className="flex-1 flex flex-col py-6">
                <div className="flex items-center gap-2 mb-8 border-b-2 border-foreground pb-4">
                  <span className="bg-muted text-muted-foreground font-mono text-xs font-bold px-2 py-1 uppercase border-2 border-muted-foreground">ID: {first.id.substring(0, 8)}</span>
                  {first.source_title && (
                    <span className="font-mono text-xs font-bold text-foreground bg-accent/20 px-2 py-1 uppercase truncate border-2 border-accent">
                      REF: {first.source_title}
                    </span>
                  )}
                </div>

                <blockquote className="font-semibold text-2xl md:text-3xl text-foreground leading-[1.5] whitespace-pre-wrap">
                  {first.content}
                </blockquote>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t-4 border-foreground">
                <button
                  type="button"
                  onClick={() => mutation.mutate({ id: first.id, action: "reviewed" })}
                  disabled={mutation.isPending}
                  className="group flex flex-col items-center justify-center p-4 md:p-6 bg-accent text-white border-4 border-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 space-y-3 cursor-pointer rounded-none active:translate-y-1 min-h-[120px]"
                >
                  {mutation.isPending && mutation.variables?.action === "reviewed" ? (
                    <LoadingDots />
                  ) : (
                    <Check className="w-8 h-8" strokeWidth={4} />
                  )}
                  <span className="font-black text-lg md:text-xl uppercase tracking-wider text-center">
                    {mutation.isPending && mutation.variables?.action === "reviewed"
                      ? t("review.processing", "Processing...")
                      : t("review.ack", "ACKNOWLEDGE")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => mutation.mutate({ id: first.id, action: "resurface" })}
                  disabled={mutation.isPending}
                  className="group flex flex-col items-center justify-center p-4 md:p-6 bg-background text-foreground border-4 border-foreground hover:bg-muted transition-colors disabled:opacity-50 space-y-3 cursor-pointer rounded-none active:translate-y-1 min-h-[120px]"
                >
                  {mutation.isPending && mutation.variables?.action === "resurface" ? (
                    <LoadingDots />
                  ) : (
                    <RefreshCcw className="w-6 h-6" strokeWidth={3} />
                  )}
                  <span className="font-black text-lg md:text-xl uppercase tracking-wider text-center">
                    {mutation.isPending && mutation.variables?.action === "resurface"
                      ? t("review.relocating", "Relocating...")
                      : t("review.resurface", "RESURFACE")}
                  </span>
                </button>
              </div>

              {mutation.error ? (
                <p className="text-background bg-destructive font-mono text-sm font-bold uppercase p-3 mt-6 border-4 border-foreground">ERR: {mutation.error.message}</p>
              ) : null}
            </div>
          )}

          {nextQueue.length > 0 ? (
            <section className="mt-8 border-4 border-foreground bg-card p-4">
              <h2 className="font-black text-2xl uppercase mb-4">{t("review.upNext", "UP NEXT")}</h2>
              <div className="space-y-2">
                {nextQueue.map((record) => (
                  <Link
                    key={record.id}
                    href={`/records/${record.id}`}
                    className="block border-2 border-foreground px-3 py-2 hover:bg-foreground hover:text-background"
                  >
                    <p className="font-mono text-xs font-bold uppercase mb-1">{record.kind} · {getStateLabel(record.state, t)}</p>
                    <p className="font-semibold text-sm line-clamp-2">{record.content}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </AuthGate>
    </div>
  )
}
