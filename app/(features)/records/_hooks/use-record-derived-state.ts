import { useMemo } from "react"
import type { AnnotationRow, RecordRow, TagRow } from "@/lib/types"

export function useRecordDerivedState({
  record,
  annotations,
  tags
}: {
  record: RecordRow | undefined
  annotations: AnnotationRow[] | undefined
  tags: Pick<TagRow, "id" | "name">[] | undefined
}) {
  const isArticleReader = useMemo(() => {
    if (!record) {
      return false
    }

    return record.kind === "link" && Boolean(record.url) && record.content.split(/\n{2,}/).filter((item) => item.trim().length > 0).length >= 2
  }, [record])

  const selectedTagIds = useMemo(() => new Set((tags ?? []).map((tag) => tag.id)), [tags])

  const markdownHighlights = useMemo(
    () =>
      (annotations ?? [])
        .filter((annotation) => annotation.kind === "highlight" && annotation.anchor)
        .map((annotation) => ({ id: annotation.id, anchor: annotation.anchor! })),
    [annotations]
  )

  return {
    isArticleReader,
    selectedTagIds,
    markdownHighlights
  }
}
