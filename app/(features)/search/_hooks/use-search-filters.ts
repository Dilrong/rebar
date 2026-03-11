import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useDebouncedValue } from "@shared/hooks/use-debounced-value"

export function useSearchFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [q, setQ] = useState("")
  const debouncedQ = useDebouncedValue(q, 220)
  const [state, setState] = useState("")
  const [tagId, setTagId] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [semantic, setSemantic] = useState(false)
  const [didInitFromUrl, setDidInitFromUrl] = useState(false)

  useEffect(() => {
    const queryQ = searchParams.get("q") ?? ""
    const queryState = searchParams.get("state") ?? ""
    const queryTag = searchParams.get("tag_id") ?? ""
    const queryFrom = searchParams.get("from") ?? ""
    const queryTo = searchParams.get("to") ?? ""
    const querySemantic = searchParams.get("semantic")

    setQ(queryQ)
    setState(queryState)
    setTagId(queryTag)
    setFromDate(queryFrom)
    setToDate(queryTo)
    setSemantic(querySemantic === "1" || querySemantic?.toLowerCase() === "true")
    setDidInitFromUrl(true)
  }, [searchParams])

  const hasActiveFilters = Boolean(q.trim() || state || tagId || fromDate || toDate)
  const hasCommittedFilters = Boolean(debouncedQ.trim() || state || tagId || fromDate || toDate)
  const currentParams = searchParams.toString()

  useEffect(() => {
    if (!hasActiveFilters && semantic) {
      setSemantic(false)
    }
  }, [hasActiveFilters, semantic])

  useEffect(() => {
    if (!didInitFromUrl) {
      return
    }

    const params = new URLSearchParams()
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim())
    if (state) params.set("state", state)
    if (tagId) params.set("tag_id", tagId)
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    if (semantic && hasCommittedFilters) params.set("semantic", "1")

    const nextParams = params.toString()
    if (nextParams === currentParams) {
      return
    }

    const nextHref = nextParams ? `${pathname}?${nextParams}` : pathname
    router.replace(nextHref, { scroll: false })
  }, [currentParams, debouncedQ, didInitFromUrl, fromDate, hasCommittedFilters, pathname, router, semantic, state, tagId, toDate])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim())
    if (state) params.set("state", state)
    if (tagId) params.set("tag_id", tagId)
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    if (semantic && hasCommittedFilters) params.set("semantic", "1")
    return params.toString()
  }, [debouncedQ, fromDate, hasCommittedFilters, semantic, state, tagId, toDate])

  return {
    q,
    setQ,
    debouncedQ,
    state,
    setState,
    tagId,
    setTagId,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    semantic,
    setSemantic,
    hasActiveFilters,
    hasCommittedFilters,
    semanticButtonDisabled: !hasActiveFilters && !semantic,
    queryString
  }
}
