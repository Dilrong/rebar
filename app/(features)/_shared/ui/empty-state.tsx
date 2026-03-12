import Link from "next/link"

type EmptyStateProps = {
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
}

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="mt-8 border-4 border-foreground bg-card p-6 text-center shadow-brutal-sm md:p-12 md:shadow-brutal">
      <p className="font-black text-2xl uppercase text-muted-foreground">{title}</p>
      {description ? <p className="mt-2 font-mono text-sm font-bold uppercase text-muted-foreground/70">{description}</p> : null}
      {actionLabel && actionHref ? (
        <div className="mt-4">
          <Link
            href={actionHref}
            className="inline-flex min-h-[44px] items-center justify-center border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background shadow-brutal-sm transition-all hover:bg-accent hover:text-accent-foreground active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
