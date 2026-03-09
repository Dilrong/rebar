import Link from "next/link"

type ReviewHeaderProps = {
  t: (key: string, fallback?: string) => string
  reviewed: number
  remaining: number
}

export function ReviewHeader({ t, reviewed, remaining }: ReviewHeaderProps) {
  const total = reviewed + remaining
  const progress = total > 0 ? Math.round((reviewed / total) * 100) : 0

  return (
    <div className="mb-8 overflow-hidden border-4 border-foreground bg-card shadow-brutal">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="font-mono text-sm font-bold tracking-widest uppercase text-foreground">
            {t("review.workload", "TODAY'S REVIEW")}
          </span>
          <p className="mt-2 font-mono text-xs font-bold uppercase text-muted-foreground">
            {reviewed}/{total} {t("review.progress", "REVIEW PROGRESS").toLowerCase()}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Link
            href="/review/history"
            className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-background px-4 py-3 font-mono text-xs font-bold uppercase shadow-brutal-sm transition-transform hover:bg-foreground hover:text-background active:translate-y-[2px] active:translate-x-[2px]"
          >
            {t("review.history", "HISTORY")}
          </Link>
          <div className="min-h-[44px] flex items-center justify-center bg-foreground px-4 py-3 text-center font-mono text-sm font-bold text-background shadow-brutal-sm">
            {t("review.remaining", "REMAINING")}: {remaining}
          </div>
        </div>
      </div>
      <div className="border-t-4 border-foreground bg-background px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] font-bold uppercase text-muted-foreground">
          <span>{t("review.progress", "REVIEW PROGRESS")}</span>
          <span>
            {reviewed}/{total}
          </span>
        </div>
        <div className="h-4 overflow-hidden border-4 border-foreground bg-card">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
