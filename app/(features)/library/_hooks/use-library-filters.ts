import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useDebouncedValue } from "@shared/hooks/use-debounced-value"
import type { RecordKind } from "@/lib/schemas"

const STATE_TABS = ["INBOX", "ACTIVE", "PINNED", "ARCHIVED"] as const
export type StateFilter = "ALL" | (typeof STATE_TABS)[number]

export function useLibraryFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [state, setState] = useState<StateFilter>("ALL")
  const [kind, setKind] = useState("")
  const [q, setQ] = useState("")
  const debouncedQ = useDebouncedValue(q, 220)
  const [tagId, setTagId] = useState("")
  const [sort, setSort] = useState<"created_at" | "review_count" | "due_at">("created_at")
  const [order, setOrder] = useState<"asc" | "desc">("desc")
  const [didInitFromUrl, setDidInitFromUrl] = useState(false)

  useEffect(() => {
    const queryState = searchParams.get("state")
    const queryKind = searchParams.get("kind")
    const queryText = searchParams.get("q")
    const queryTag = searchParams.get("tag_id")
    const querySort = searchParams.get("sort")
    const queryOrder = searchParams.get("order")

    setState(
      queryState === "ALL" || queryState === "INBOX" || queryState === "ACTIVE" || queryState === "PINNED" || queryState === "ARCHIVED"
        ? queryState
        : "ALL"
    )
    setKind(queryKind === "quote" || queryKind === "note" || queryKind === "link" || queryKind === "ai" ? queryKind : "")
    setQ(queryText ?? "")
    setTagId(queryTag ?? "")
    setSort(querySort === "created_at" || querySort === "review_count" || querySort === "due_at" ? querySort : "created_at")
    setOrder(queryOrder === "asc" || queryOrder === "desc" ? queryOrder : "desc")
    setDidInitFromUrl(true)
  }, [searchParams])

  const currentParams = searchParams.toString()

  useEffect(() => {
    if (!didInitFromUrl) {
      return
    }

    const params = new URLSearchParams()
    if (state !== "ALL") params.set("state", state)
    if (kind) params.set("kind", kind)
    if (debouncedQ) params.set("q", debouncedQ)
    if (tagId) params.set("tag_id", tagId)
    params.set("sort", sort)
    params.set("order", order)

    const nextParams = params.toString()
    if (nextParams === currentParams) {
      return
    }

    const nextHref = nextParams ? `${pathname}?${nextParams}` : pathname
    router.replace(nextHref, { scroll: false })
  }, [currentParams, debouncedQ, didInitFromUrl, kind, order, pathname, router, sort, state, tagId])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (state !== "ALL") params.set("state", state)
    if (kind) params.set("kind", kind)
    if (debouncedQ) params.set("q", debouncedQ)
    if (tagId) params.set("tag_id", tagId)
    params.set("sort", sort)
    params.set("order", order)
    return params.toString()
  }, [debouncedQ, kind, order, sort, state, tagId])

  const clearAllFilters = () => {
    setQ("")
    setKind("")
    setTagId("")
    setState("ALL")
  }

  return {
    didInitFromUrl,
    state,
    setState,
    kind: kind as "" | RecordKind,
    setKind,
    q,
    setQ,
    debouncedQ,
    tagId,
    setTagId,
    sort,
    setSort,
    order,
    setOrder,
    queryString,
    clearAllFilters
  }
}
