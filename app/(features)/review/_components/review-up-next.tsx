import Link from "next/link"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { RecordRow } from "@/lib/types"

type ReviewUpNextProps = {
  queue: RecordRow[]
  reviewBackHref: string
  t: (key: string, fallback?: string) => string
}

export function ReviewUpNext({ queue, reviewBackHref, t }: ReviewUpNextProps) {
  if (queue.length === 0) {
    return null
  }

  return (
    <section className="mt-8 border-4 border-foreground bg-card shadow-brutal">
      <details open className="group">
        <summary className="flex cursor-pointer items-center justify-between border-b-4 border-foreground p-4 md:p-6 font-black text-xl uppercase select-none list-none">
          <span className="flex items-center gap-3">
            <span className="border-l-4 border-accent pl-4">{t("review.upNext", "UP NEXT")}</span>
            <span className="font-mono text-sm text-muted-foreground">({queue.length})</span>
          </span>
          <span className="font-mono text-xs text-muted-foreground group-open:hidden">▼ SHOW</span>
          <span className="font-mono text-xs text-muted-foreground hidden group-open:inline">▲ HIDE</span>
        </summary>
        <div className="space-y-0 p-4 md:p-6 pt-0 md:pt-0">
          {queue.map((record) => (
            <Link
              key={record.id}
              href={`/records/${record.id}?from=${encodeURIComponent(reviewBackHref)}`}
              className="block min-h-[44px] border-2 border-foreground px-4 py-3 mt-3 hover:bg-foreground hover:text-background transition-colors"
            >
              <p className="font-mono text-xs font-bold uppercase mb-2">{record.kind} · {getStateLabel(record.state, t)}</p>
              <p className="font-semibold text-sm line-clamp-2">{record.content}</p>
            </Link>
          ))}
        </div>
      </details>
    </section>
  )
}
