"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { BookOpen, CheckSquare, Plus, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { apiFetch } from "@/lib/client-http"
import { useDebouncedValue } from "@shared/hooks/use-debounced-value"
import type { RecordRow } from "@/lib/types"
import { cn } from "@/lib/utils"

type RecordsResponse = {
  data: RecordRow[]
}

type SearchResponse = {
  data: RecordRow[]
}

type CommandPaletteProps = {
  t: (key: string, fallback?: string) => string
  open: boolean
  onClose: () => void
  buildRecordHref: (recordId: string) => string
}

type CommandActionItem = {
  id: string
  type: "action"
  label: string
  href: string
  icon: typeof Plus
}

type CommandRecordItem = {
  id: string
  type: "record"
  record: RecordRow
}

type CommandItem = CommandActionItem | CommandRecordItem

const ACTION_ITEMS: Array<Omit<CommandActionItem, "label">> = [
  { id: "action-capture", type: "action", href: "/capture", icon: Plus },
  { id: "action-review", type: "action", href: "/review", icon: CheckSquare },
  { id: "action-library", type: "action", href: "/library", icon: BookOpen }
]

export function CommandPalette({ t, open, onClose, buildRecordHref }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 160)
  const [activeIndex, setActiveIndex] = useState(0)

  const recentRecords = useQuery({
    queryKey: ["command-palette", "recent"],
    queryFn: () => apiFetch<RecordsResponse>("/api/records?sort=created_at&order=desc&limit=5"),
    enabled: open && debouncedQuery.trim().length === 0,
    staleTime: 1000 * 60 * 2
  })

  const searchResults = useQuery({
    queryKey: ["command-palette", "search", debouncedQuery],
    queryFn: () => apiFetch<SearchResponse>(`/api/search?q=${encodeURIComponent(debouncedQuery.trim())}&limit=6`),
    enabled: open && debouncedQuery.trim().length > 0,
    staleTime: 1000 * 30,
    placeholderData: keepPreviousData
  })

  const recordItems = useMemo<CommandRecordItem[]>(() => {
    const rows = debouncedQuery.trim().length > 0
      ? searchResults.data?.data ?? []
      : recentRecords.data?.data ?? []
    return rows.map((record) => ({
      id: record.id,
      type: "record",
      record
    }))
  }, [debouncedQuery, recentRecords.data?.data, searchResults.data?.data])

  const actionItems = useMemo<CommandActionItem[]>(
    () => [
      { ...ACTION_ITEMS[0], label: t("commandPalette.goCapture", "OPEN CAPTURE") },
      { ...ACTION_ITEMS[1], label: t("commandPalette.goReview", "OPEN REVIEW") },
      { ...ACTION_ITEMS[2], label: t("commandPalette.goLibrary", "OPEN LIBRARY") }
    ],
    [t]
  )

  const flattenedItems = useMemo<CommandItem[]>(() => [...recordItems, ...actionItems], [actionItems, recordItems])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    setQuery("")
    setActiveIndex(0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    if (flattenedItems.length === 0) {
      setActiveIndex(-1)
      return
    }

    setActiveIndex((current) => {
      if (current < 0) {
        return 0
      }

      return Math.min(current, flattenedItems.length - 1)
    })
  }, [flattenedItems.length])

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (flattenedItems.length === 0) {
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % flattenedItems.length)
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((current) => (current <= 0 ? flattenedItems.length - 1 : current - 1))
        return
      }

      if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault()
        const activeItem = flattenedItems[activeIndex]
        if (!activeItem) {
          return
        }

        onClose()
        if (activeItem.type === "record") {
          router.push(buildRecordHref(activeItem.record.id))
          return
        }

        router.push(activeItem.href)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeIndex, buildRecordHref, flattenedItems, onClose, open, router])

  if (!open) {
    return null
  }

  const loading = debouncedQuery.trim().length > 0 ? searchResults.isFetching : recentRecords.isFetching

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="mt-12 flex w-full max-w-2xl flex-col overflow-hidden border-4 border-foreground bg-card shadow-brutal"
      >
        <div className="border-b-4 border-foreground p-4">
          <p id="command-palette-title" className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
            Cmd+K / Ctrl+K
          </p>
          <label htmlFor="command-palette-input" className="sr-only">
            {t("commandPalette.placeholder", "SEARCH OR NAVIGATE...")}
          </label>
          <input
            id="command-palette-input"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("commandPalette.placeholder", "SEARCH OR NAVIGATE...")}
            className="mt-3 min-h-[56px] w-full border-4 border-foreground bg-background px-4 py-3 font-mono text-base font-bold uppercase placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
              ↑↓ select · Enter open · Esc close
            </p>
            <Link
              href={query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search"}
              className="inline-flex min-h-[40px] items-center justify-center border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
              onClick={onClose}
            >
              {t("nav.search", "SEARCH")}
            </Link>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          <section>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {debouncedQuery.trim().length > 0 ? t("nav.search", "SEARCH") : t("commandPalette.recent", "RECENT")}
            </p>
            <div className="space-y-2">
              {recordItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onClose()
                    router.push(buildRecordHref(item.record.id))
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex min-h-[64px] w-full flex-col items-start justify-center border-2 border-foreground bg-background px-4 py-3 text-left transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none",
                    activeIndex === index && "ring-4 ring-accent"
                  )}
                >
                  <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                    {item.record.kind} · {item.record.state}
                  </span>
                  <span className="mt-1 line-clamp-2 text-sm font-semibold">
                    {item.record.content}
                  </span>
                </button>
              ))}

              {!loading && recordItems.length === 0 ? (
                <p className="border-2 border-dashed border-foreground p-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {debouncedQuery.trim().length > 0
                    ? t("nav.quickEmpty", "NO MATCHES")
                    : t("nav.quickHint", "TYPE TO SEARCH")}
                </p>
              ) : null}

              {loading ? (
                <p className="border-2 border-foreground p-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {t("nav.quickSearching", "SEARCHING...")}
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-5">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("commandPalette.actions", "QUICK ACTIONS")}
            </p>
            <div className="space-y-2">
              {actionItems.map((item, offset) => {
                const index = recordItems.length + offset
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onClose()
                      router.push(item.href)
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex min-h-[56px] w-full items-center gap-3 border-2 border-foreground bg-background px-4 py-3 text-left font-mono text-xs font-bold uppercase transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none",
                      activeIndex === index && "ring-4 ring-accent"
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.5} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
