import Link from "next/link"

type ReviewHeaderProps = {
  t: (key: string, fallback?: string) => string
  remaining: number
}

export function ReviewHeader({ t, remaining }: ReviewHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-4 border-foreground bg-card p-4 shadow-brutal md:flex-row md:items-center md:justify-between">
      <span className="font-mono text-sm font-bold tracking-widest uppercase text-foreground">
        {t("review.workload", "TODAY'S REVIEW")}
      </span>
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
  )
}
