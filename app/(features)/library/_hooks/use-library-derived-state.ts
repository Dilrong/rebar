import { useMemo } from "react"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { TagRow } from "@/lib/types"
import type { RecordKind } from "@/lib/schemas"

function getExportKindLabel(kind: RecordKind, t: (key: string, fallback?: string) => string) {
  if (kind === "quote") {
    return t("capture.kind.quote", "Quote / Highlight")
  }

  if (kind === "note") {
    return t("capture.kind.note", "Note")
  }

  if (kind === "link") {
    return t("capture.kind.link", "Web Link")
  }

  return t("capture.kind.ai", "AI Content")
}

function toDateInputValue(date: Date) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return normalized.toISOString().slice(0, 10)
}

export function useLibraryDerivedState({
  tags,
  tagId,
  state,
  kind,
  exportSince,
  q,
  t
}: {
  tags: TagRow[]
  tagId: string
  state: "ALL" | "INBOX" | "ACTIVE" | "PINNED" | "ARCHIVED"
  kind: "" | RecordKind
  exportSince: string
  q: string
  t: (key: string, fallback?: string) => string
}) {
  const selectedTagName = useMemo(() => tags.find((tag) => tag.id === tagId)?.name ?? null, [tagId, tags])

  const exportSincePresets = useMemo(() => {
    const now = new Date()
    const last7 = new Date(now)
    last7.setDate(last7.getDate() - 7)
    const last30 = new Date(now)
    last30.setDate(last30.getDate() - 30)

    return [
      { key: "library.exportPresetToday", fallback: "TODAY", value: toDateInputValue(now) },
      { key: "library.exportPreset7d", fallback: "LAST 7D", value: toDateInputValue(last7) },
      { key: "library.exportPreset30d", fallback: "LAST 30D", value: toDateInputValue(last30) }
    ]
  }, [])

  const exportScopeLabel = useMemo(() => {
    const parts: string[] = []

    if (state !== "ALL") {
      parts.push(getStateLabel(state, t))
    }

    if (kind) {
      parts.push(getExportKindLabel(kind, t))
    }

    if (selectedTagName) {
      parts.push(`#${selectedTagName}`)
    }

    if (exportSince) {
      parts.push(exportSince)
    }

    return parts.length > 0 ? parts.join(" · ") : t("library.exportScopeAll", "FULL LIBRARY (EXCLUDING TRASH)")
  }, [exportSince, kind, selectedTagName, state, t])

  const emptyState = useMemo(() => {
    if (q.trim()) {
      return {
        title: t("library.emptySearch", "NO SEARCH RESULTS"),
        description: `'${q.trim()}'에 대한 결과가 없습니다`,
        actionLabel: t("library.clearAll", "Clear all"),
        actionHref: "/library"
      }
    }

    if (state === "INBOX" && !kind && !tagId) {
      return {
        title: t("library.emptyInbox", "INBOX IS EMPTY"),
        description: "수집함이 비었습니다 -> 캡처로 새 항목 추가",
        actionLabel: t("library.goCapture", "Go capture"),
        actionHref: "/capture"
      }
    }

    if (state === "ACTIVE" && !kind && !tagId) {
      return {
        title: t("library.emptyActive", "NO ACTIVE ITEMS"),
        description: "활성 항목이 없습니다 -> 리뷰에서 항목을 활성화하세요",
        actionLabel: t("nav.review", "Review"),
        actionHref: "/review"
      }
    }

    return {
      title: t("library.noResults", "0 RESULTS FOUND."),
      actionLabel: t("library.goCapture", "Go capture"),
      actionHref: "/capture"
    }
  }, [kind, q, state, t, tagId])

  return {
    selectedTagName,
    exportSincePresets,
    exportScopeLabel,
    emptyState
  }
}
