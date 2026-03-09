import Link from "next/link"

type ReviewCompleteScreenProps = {
  t: (key: string, fallback?: string) => string
  reviewed: number
  streakDays: number
  totalActive: number
}

export function ReviewCompleteScreen({
  t,
  reviewed,
  streakDays,
  totalActive
}: ReviewCompleteScreenProps) {
  return (
    <section className="mt-4 border-4 border-accent bg-card p-6 shadow-brutal">
      <p className="font-mono text-[10px] font-bold uppercase text-accent">
        {t("review.complete.title", "PIPELINE CLEAR")}
      </p>
      <h2 className="mt-3 text-3xl font-black uppercase text-foreground md:text-5xl">
        PIPELINE CLEAR
      </h2>
      <p className="mt-3 font-mono text-xs font-bold uppercase text-muted-foreground">
        {t("review.noPending", "No review items due today.")}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="border-4 border-foreground bg-background p-4">
          <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("review.complete.reviewed", "REVIEWED TODAY")}
          </p>
          <p className="mt-2 text-3xl font-black uppercase text-foreground">{reviewed}</p>
        </div>
        <div className="border-4 border-foreground bg-background p-4">
          <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("review.complete.streak", "STREAK")}
          </p>
          <p className="mt-2 text-3xl font-black uppercase text-foreground">{streakDays}D</p>
        </div>
        <div className="border-4 border-foreground bg-background p-4">
          <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("review.complete.totalActive", "ACTIVE RECORDS")}
          </p>
          <p className="mt-2 text-3xl font-black uppercase text-foreground">{totalActive}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/capture"
          className="inline-flex min-h-[48px] items-center justify-center border-4 border-foreground bg-accent px-5 py-3 font-mono text-xs font-bold uppercase text-white shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          {t("review.complete.goCapture", "GO CAPTURE")}
        </Link>
        <Link
          href="/library"
          className="inline-flex min-h-[48px] items-center justify-center border-4 border-foreground bg-background px-5 py-3 font-mono text-xs font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          {t("review.complete.goLibrary", "BROWSE LIBRARY")}
        </Link>
      </div>
    </section>
  )
}
