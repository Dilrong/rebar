import Link from "next/link"

type EmptyStateProps = {
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
}

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="mt-8 border-4 border-dashed border-border bg-muted/20 p-12 text-center">
      <p className="font-black text-2xl uppercase text-muted-foreground">{title}</p>
      {description ? <p className="mt-2 font-mono text-sm font-bold uppercase text-muted-foreground/70">{description}</p> : null}
      {actionLabel && actionHref ? (
        <div className="mt-4">
          <Link
            href={actionHref}
            className="border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background"
          >
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
