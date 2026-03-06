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
    <section className="mt-8 border-4 border-foreground bg-card shadow-brutal hover:shadow-brutal-sm transition-shadow duration-300">
      <details open className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-3 border-b-4 border-foreground p-4 text-xl font-black uppercase select-none transition-colors hover:bg-foreground/5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <span className="flex items-center gap-3">
            <span className="border-l-4 md:border-l-8 border-accent pl-4 text-glitch relative">{t("review.upNext", "UP NEXT")}</span>
            <span className="font-mono text-sm text-muted-foreground border-2 border-muted-foreground/30 px-2 group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent transition-colors">QUEUE:{queue.length}</span>
          </span>
          <span className="self-start bg-foreground px-2 py-1 font-mono text-xs uppercase tracking-widest text-background group-open:hidden sm:self-auto">▼ SHOW</span>
          <span className="hidden self-start border-2 border-foreground px-2 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground group-open:inline sm:self-auto">▲ HIDE</span>
        </summary>
        <div className="space-y-0 p-4 md:p-6 pt-0 md:pt-0 pb-6 group-open:animate-accordion-down">
          {queue.map((record) => (
            <Link
              key={record.id}
              href={`/records/${record.id}?from=${encodeURIComponent(reviewBackHref)}`}
              className="block min-h-[44px] border-[3px] md:border-4 border-foreground px-4 py-3 mt-4 hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none"
            >
              <p className="font-mono text-xs font-bold uppercase mb-2">
                <span className="bg-foreground text-background group-hover:bg-background group-hover:text-foreground px-2 py-0.5 inline-block border-2 border-transparent transition-colors">
                  {record.kind}
                </span>
                <span className="ml-2">— {getStateLabel(record.state, t)}</span>
              </p>
              <p className="font-semibold text-sm md:text-base line-clamp-2 md:line-clamp-3">{record.content}</p>
            </Link>
          ))}
        </div>
      </details>
    </section>
  )
}
