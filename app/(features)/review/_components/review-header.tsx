import Link from "next/link"

type ReviewHeaderProps = {
  t: (key: string, fallback?: string) => string
  remaining: number
}

export function ReviewHeader({ t, remaining }: ReviewHeaderProps) {
  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between border-4 border-foreground bg-card p-4 shadow-brutal gap-4">
      <span className="font-mono text-sm font-bold tracking-widest uppercase text-foreground">
        {t("review.workload", "TODAY'S REVIEW")}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/review/history"
          className="min-h-[44px] flex items-center justify-center font-mono text-xs font-bold uppercase border-4 border-foreground px-4 py-3 bg-background hover:bg-foreground hover:text-background shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px]"
        >
          {t("review.history", "HISTORY")}
        </Link>
        <div className="min-h-[44px] flex items-center justify-center font-mono text-sm font-bold bg-foreground text-background px-4 py-3 shadow-brutal-sm">
          {t("review.remaining", "REMAINING")}: {remaining}
        </div>
      </div>
    </div>
  )
}
