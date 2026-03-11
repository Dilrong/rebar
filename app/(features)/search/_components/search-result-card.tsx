import Link from "next/link"
import { Fragment } from "react"
import { getStateLabel } from "@/lib/i18n/state-label"
import { stripMarkdown } from "@feature-lib/content/strip-markdown"
import type { RecordRow } from "@/lib/types"

export type SearchResultRow = RecordRow & {
  semantic_score?: number
  semantic_matches?: string[]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlightText(text: string, query: string) {
  const tokens = Array.from(new Set(query.trim().split(/\s+/).filter((token) => token.length > 0)))
  if (tokens.length === 0) {
    return text
  }

  const matcher = new RegExp(`(${tokens.map((token) => escapeRegExp(token)).join("|")})`, "gi")
  return text.split(matcher).map((part, index) => {
    if (tokens.some((token) => token.toLowerCase() === part.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="border-2 border-foreground bg-accent px-1 font-bold text-accent-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]">
          {part}
        </mark>
      )
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

type SearchResultCardProps = {
  t: (key: string, fallback?: string) => string
  record: SearchResultRow
  index: number
  activeIndex: number
  semantic: boolean
  debouncedQ: string
  toRecordHref: (id: string) => string
  onPrefetch: (id: string) => void
  onFocusIndex: (index: number) => void
}

export function SearchResultCard(props: SearchResultCardProps) {
  const { t, record, index, activeIndex, semantic, debouncedQ, toRecordHref, onPrefetch, onFocusIndex } = props

  return (
    <Link
      href={toRecordHref(record.id)}
      onMouseEnter={() => onPrefetch(record.id)}
      onFocus={() => {
        onPrefetch(record.id)
        onFocusIndex(index)
      }}
      className={`group flex h-48 flex-col border-[3px] border-foreground bg-card p-4 shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none md:h-72 md:border-4 md:p-5 md:shadow-brutal ${activeIndex === index ? "translate-x-1 translate-y-1 bg-foreground text-background shadow-none" : ""}`}
    >
      <div className="mb-3 flex gap-2">
        {record.favicon_url ? (
          <img
            src={record.favicon_url}
            alt=""
            width={16}
            height={16}
            className="mt-0.5 h-4 w-4 flex-shrink-0 object-contain"
            onError={(event) => {
              ;(event.target as HTMLImageElement).style.display = "none"
            }}
          />
        ) : null}
        <span className="border-2 border-current px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase group-hover:border-background">{record.kind}</span>
        <span className="border-2 border-current px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase group-hover:border-background">{getStateLabel(record.state, t)}</span>
      </div>
      {semantic && typeof record.semantic_score === "number" ? (
        <p className="mb-2 font-mono text-[10px] font-bold uppercase text-accent group-hover:text-background/80">
          {t("search.semanticScore", "SEMANTIC SCORE")}: {record.semantic_score.toFixed(2)}
        </p>
      ) : null}
      <p className="flex-1 line-clamp-5 text-lg font-bold leading-tight">{highlightText(stripMarkdown(record.content), debouncedQ)}</p>
      {semantic && record.semantic_matches && record.semantic_matches.length > 0 ? (
        <p className="mt-2 line-clamp-1 font-mono text-[10px] font-bold uppercase text-muted-foreground group-hover:text-background/70">
          {t("search.semanticMatches", "MATCHES")}: {record.semantic_matches.join(", ")}
        </p>
      ) : null}
      {record.source_title ? (
        <p className="mt-3 truncate font-mono text-[10px] font-bold uppercase text-muted-foreground group-hover:text-background/70">REF: {record.source_title}</p>
      ) : null}
    </Link>
  )
}
