"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, Download, Play, Plus, Search, Tag, Trash2 } from "lucide-react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { apiFetch } from "@/lib/client-http"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { LoadingSpinner, LoadingDots } from "@shared/ui/loading"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { getStateLabel } from "@/lib/i18n/state-label"
import { EmptyState } from "@shared/ui/empty-state"
import { ErrorState } from "@shared/ui/error-state"
import { Skeleton } from "@shared/ui/skeleton"

import type { RecordRow, TagRow } from "@/lib/types"
import { stripMarkdown } from "@feature-lib/content/strip-markdown"

type RecordsResponse = {
  data: RecordRow[]
  total: number
  next_cursor?: string | null
}

type TagsResponse = {
  data: TagRow[]
}

const STATE_TABS = ["INBOX", "ACTIVE", "PINNED", "ARCHIVED"] as const
type StateFilter = "ALL" | (typeof STATE_TABS)[number]

export default function LibraryPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [state, setState] = useState<StateFilter>("ALL")
  const [kind, setKind] = useState("")
  const [q, setQ] = useState("")
  const [tagId, setTagId] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const [sort, setSort] = useState<"created_at" | "review_count" | "due_at">("created_at")
  const [order, setOrder] = useState<"asc" | "desc">("desc")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportMenuIndex, setExportMenuIndex] = useState(0)
  const exportMenuWrapRef = useRef<HTMLDivElement | null>(null)
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null)
  const exportItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [exportPending, setExportPending] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [allRecords, setAllRecords] = useState<RecordRow[]>([])
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (state !== "ALL") {
      params.set("state", state)
    }
    if (kind) {
      params.set("kind", kind)
    }
    if (q) {
      params.set("q", q)
    }
    if (tagId) {
      params.set("tag_id", tagId)
    }
    params.set("sort", sort)
    params.set("order", order)
    return params.toString()
  }, [kind, order, q, sort, state, tagId])

  // Reset accumulated records + cursor when filters change
  useEffect(() => {
    setAllRecords([])
    setCursor(null)
  }, [queryString])

  const qc = useQueryClient()

  function prefetchRecord(id: string) {
    qc.prefetchQuery({
      queryKey: ["record-detail", id],
      queryFn: () => apiFetch<{ record: RecordRow }>(`/api/records/${id}`),
      staleTime: 1000 * 60 * 5
    })
  }



  const records = useQuery({
    queryKey: ["records", queryString, sort, order],
    queryFn: async () => {
      const data = await apiFetch<RecordsResponse>(`/api/records?${queryString}`)
      setAllRecords(data.data)
      setCursor(data.next_cursor ?? null)
      return data
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10 // 10 minutes
  })

  const selectedTagName = (tags.data?.data ?? []).find((tag) => tag.id === tagId)?.name ?? null

  const activate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "ACTIVE" })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const bulkStateMutation = useMutation({
    mutationFn: (payload: { ids: string[]; state: "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED" }) =>
      apiFetch<{ updated: number; failed: number }>("/api/records/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const bulkTagMutation = useMutation({
    mutationFn: (payload: { ids: string[]; tag_ids: string[]; mode: "add" | "replace" }) =>
      apiFetch<{ processed: number }>("/api/records/bulk/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setSelectedIds([])
      setBulkTagIds([])
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const createTag = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ tag: TagRow }>("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      }),
    onSuccess: () => {
      setNewTagName("")
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    }
  })

  const renameTag = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<{ tag: TagRow }>(`/api/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] })
  })

  const deleteTag = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: true }>(`/api/tags/${id}`, {
        method: "DELETE"
      }),
    onSuccess: (_data, id) => {
      if (tagId === id) {
        setTagId("")
      }
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const buildExportHref = (format: "markdown" | "obsidian") => {
    const params = new URLSearchParams()
    params.set("format", format)
    if (state !== "ALL") {
      params.set("state", state)
    }
    if (tagId) {
      params.set("tag_id", tagId)
    }
    return `/api/export?${params.toString()}`
  }

  const handleExport = async (format: "markdown" | "obsidian") => {
    setExportPending(true)
    setExportError(null)

    try {
      const headers = new Headers()
      const supabase = getSupabaseBrowser()
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        headers.set("Authorization", `Bearer ${session.access_token}`)
      }

      const devUserId = process.env.NEXT_PUBLIC_DEV_USER_ID
      if (devUserId && !headers.has("Authorization")) {
        headers.set("x-user-id", devUserId)
      }

      const response = await fetch(buildExportHref(format), { headers })
      if (!response.ok) {
        let message = "Export failed"
        try {
          const data = (await response.json()) as { error?: string }
          if (data.error) {
            message = data.error
          }
        } catch { }
        throw new Error(message)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const today = new Date().toISOString().slice(0, 10)
      anchor.href = downloadUrl
      anchor.download = format === "obsidian" ? `rebar-obsidian-export-${today}.md` : `rebar-export-${today}.md`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExportPending(false)
    }
  }

  const loadMore = async () => {
    if (!cursor) return
    const params = new URLSearchParams(queryString)
    params.set("cursor", cursor)
    try {
      const data = await apiFetch<RecordsResponse>(`/api/records?${params.toString()}`)
      setAllRecords((prev) => [...prev, ...data.data])
      setCursor(data.next_cursor ?? null)
    } catch { }
  }

  const handleRenameTag = (tag: TagRow) => {
    setEditingTagId(tag.id)
    setEditingTagName(tag.name)
  }

  const submitRenameTag = (id: string) => {
    const trimmed = editingTagName.trim()
    setEditingTagId(null)
    if (!trimmed) return
    renameTag.mutate({ id, name: trimmed })
  }

  const clearAllFilters = () => {
    setQ("")
    setKind("")
    setTagId("")
    setState("ALL")
  }

  const visibleIds = (records.data?.data ?? []).map((record) => record.id)
  const toggleSelect = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const selectVisible = () => {
    setSelectedIds(visibleIds)
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const applyBulkState = (nextState: "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED") => {
    if (selectedIds.length === 0) {
      return
    }
    bulkStateMutation.mutate({ ids: selectedIds, state: nextState })
  }

  const applyBulkTags = (mode: "add" | "replace") => {
    if (selectedIds.length === 0 || bulkTagIds.length === 0) {
      return
    }
    bulkTagMutation.mutate({ ids: selectedIds, tag_ids: bulkTagIds, mode })
  }

  useEffect(() => {
    if (!exportMenuOpen) {
      return
    }

    const handleOutside = (event: MouseEvent) => {
      const wrap = exportMenuWrapRef.current
      if (!wrap) {
        return
      }

      if (!wrap.contains(event.target as Node)) {
        setExportMenuOpen(false)
        exportTriggerRef.current?.focus()
      }
    }

    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [exportMenuOpen])

  useEffect(() => {
    if (!exportMenuOpen) {
      return
    }

    exportItemRefs.current[exportMenuIndex]?.focus()
  }, [exportMenuIndex, exportMenuOpen])

  const closeExportMenu = () => {
    setExportMenuOpen(false)
    setExportMenuIndex(0)
    exportTriggerRef.current?.focus()
  }

  const handleExportMenuKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!exportMenuOpen) {
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      closeExportMenu()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setExportMenuIndex((idx) => (idx + 1) % 2)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setExportMenuIndex((idx) => (idx <= 0 ? 1 : idx - 1))
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
      setExportMenuIndex((idx) => (event.shiftKey ? (idx <= 0 ? 1 : idx - 1) : (idx + 1) % 2))
    }
  }

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <AuthGate>
        <main className="max-w-6xl mx-auto animate-fade-in-up pb-24">
          <AppNav />

          <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b-4 border-foreground pb-4 gap-4">
            <h1 className="font-black text-5xl uppercase text-foreground leading-none flex items-center gap-4">
              <Database className="w-10 h-10" strokeWidth={3} />
              {t("library.title", "VAULT")}
            </h1>
            <div className="flex items-center gap-3">
              <span className="min-h-[44px] flex items-center justify-center font-mono text-sm font-bold bg-foreground text-background px-3 py-2 uppercase">
                {t("library.rows", "ROWS")}: {records.data?.total || 0}
              </span>
              <div ref={exportMenuWrapRef} className="relative">
                <button
                  ref={exportTriggerRef}
                  type="button"
                  onClick={() => {
                    setExportMenuOpen((v) => !v)
                    setExportMenuIndex(0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault()
                      setExportMenuOpen(true)
                      setExportMenuIndex(0)
                    }
                  }}
                  disabled={exportPending}
                  className="min-h-[44px] inline-flex items-center gap-2 border-2 border-foreground bg-background px-4 py-3 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background disabled:opacity-60 shadow-brutal-sm transition-colors"
                  aria-haspopup="menu"
                  aria-expanded={exportMenuOpen}
                  aria-controls="library-export-menu"
                >
                  <Download className="h-4 w-4" />
                  {exportPending ? t("library.exporting", "EXPORTING...") : `${t("library.export", "EXPORT")} ▾`}
                </button>
                {exportMenuOpen ? (
                  <div id="library-export-menu" role="menu" className="absolute right-0 z-20 mt-1 min-w-[180px] border-2 border-foreground bg-background">
                    <button
                      ref={(node) => {
                        exportItemRefs.current[0] = node
                      }}
                      type="button"
                      onClick={() => {
                        closeExportMenu()
                        handleExport("markdown")
                      }}
                      onKeyDown={handleExportMenuKeyDown}
                      className="block w-full border-b border-foreground px-3 py-2 text-left font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background min-h-[44px]"
                      role="menuitem"
                    >
                      Markdown (.md)
                    </button>
                    <button
                      ref={(node) => {
                        exportItemRefs.current[1] = node
                      }}
                      type="button"
                      onClick={() => {
                        closeExportMenu()
                        handleExport("obsidian")
                      }}
                      onKeyDown={handleExportMenuKeyDown}
                      className="block w-full px-3 py-2 text-left font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background min-h-[44px]"
                      role="menuitem"
                    >
                      Obsidian (frontmatter)
                    </button>
                  </div>
                ) : null}
              </div>
              <Link
                href="/capture"
                className="max-md:hidden min-h-[44px] inline-flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase border-2 border-foreground px-4 py-3 bg-background hover:bg-foreground hover:text-background shadow-brutal-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t("library.newRecord", "NEW RECORD")}
              </Link>
            </div>
          </header>

          <section className="mb-8 border-4 border-foreground bg-card p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                key="ALL"
                type="button"
                onClick={() => setState("ALL")}
                className={`min-h-[44px] px-4 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase flex items-center justify-center ${state === "ALL" ? "bg-foreground text-background" : "bg-background text-foreground"
                  }`}
              >
                {t("library.allView", "전체보기")}
              </button>
              {STATE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setState(tab)}
                  className={`min-h-[44px] px-4 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase flex items-center justify-center ${state === tab ? "bg-foreground text-background" : "bg-background text-foreground"
                    }`}
                >
                  {getStateLabel(tab, t)}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t("library.searchPlaceholder", "Search content/title")}
                className="min-h-[44px] bg-background border-2 border-foreground text-foreground px-4 py-3 font-mono text-sm w-full md:w-auto shadow-brutal-sm flex-1"
              />
              <div className="grid grid-cols-2 lg:flex lg:flex-row gap-3">
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  className="min-h-[44px] bg-background border-2 border-foreground text-foreground px-4 py-2 font-mono text-sm w-full md:w-auto"
                >
                  <option value="">{t("library.allKinds", "All kinds")}</option>
                  <option value="quote">quote</option>
                  <option value="note">note</option>
                  <option value="link">link</option>
                  <option value="ai">ai</option>
                </select>
                <select
                  value={tagId}
                  onChange={(event) => setTagId(event.target.value)}
                  className="min-h-[44px] bg-background border-2 border-foreground text-foreground px-4 py-2 font-mono text-sm w-full md:w-auto"
                >
                  <option value="">{t("library.allTags", "All tags")}</option>
                  {(tags.data?.data ?? []).map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      #{tag.name}
                    </option>
                  ))}
                </select>
                <select
                  value={`${sort}:${order}`}
                  onChange={(event) => {
                    const [nextSort, nextOrder] = event.target.value.split(":") as [typeof sort, typeof order]
                    setSort(nextSort)
                    setOrder(nextOrder)
                  }}
                  className="min-h-[44px] bg-background border-2 border-foreground px-4 py-2 font-mono text-sm text-foreground w-full md:w-auto col-span-2 lg:col-span-1"
                >
                  <option value="created_at:desc">Newest first</option>
                  <option value="created_at:asc">Oldest first</option>
                  <option value="review_count:desc">Most reviewed</option>
                  <option value="due_at:asc">Due soonest</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground mr-2">{t("library.activeFilters", "Active filters")}</span>
              <button
                type="button"
                onClick={() => setState("ALL")}
                className="min-h-[44px] flex items-center justify-center border border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase"
              >
                {t("library.state", "State")}: {state === "ALL" ? t("library.allView", "전체보기") : getStateLabel(state, t)}
              </button>
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="min-h-[44px] flex items-center justify-center border border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase"
                >
                  {t("library.query", "Search")}: {q} x
                </button>
              ) : null}
              {kind ? (
                <button
                  type="button"
                  onClick={() => setKind("")}
                  className="min-h-[44px] flex items-center justify-center border border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase"
                >
                  {t("library.kind", "Kind")}: {kind} x
                </button>
              ) : null}
              {tagId ? (
                <button
                  type="button"
                  onClick={() => setTagId("")}
                  className="min-h-[44px] flex items-center justify-center border border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase"
                >
                  {t("library.tag", "Tag")}: {selectedTagName ? `#${selectedTagName}` : tagId.slice(0, 6)} x
                </button>
              ) : null}
              {(q || kind || tagId || state !== "ALL") ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase text-background"
                >
                  {t("library.clearAll", "Clear all")}
                </button>
              ) : null}
            </div>
          </section>

          {selectedIds.length > 0 ? (
            <section className="mb-8 border-4 border-foreground bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs font-bold uppercase">{selectedIds.length} {t("library.selected", "선택됨")}</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectVisible} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                    {t("library.selectVisible", "보이는 항목 선택")}
                  </button>
                  <button type="button" onClick={clearSelection} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                    {t("library.clearSelection", "선택 해제")}
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => applyBulkState("ACTIVE")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                  {t("library.bulk.activate", "활성화")}
                </button>
                <button type="button" onClick={() => applyBulkState("PINNED")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                  {t("library.bulk.pin", "핀 고정")}
                </button>
                <button type="button" onClick={() => applyBulkState("ARCHIVED")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                  {t("library.bulk.archive", "보관")}
                </button>
                <button type="button" onClick={() => applyBulkState("TRASHED")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                  {t("library.bulk.trash", "휴지통")}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bulkTagIds[0] ?? ""}
                  onChange={(event) => setBulkTagIds(event.target.value ? [event.target.value] : [])}
                  className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs"
                >
                  <option value="">{t("library.bulk.tagPlaceholder", "태그 선택")}</option>
                  {(tags.data?.data ?? []).map((tag) => (
                    <option key={tag.id} value={tag.id}>#{tag.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => applyBulkTags("add")} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                  {t("library.bulk.addTag", "태그 추가")}
                </button>
                <button type="button" onClick={() => applyBulkTags("replace")} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                  {t("library.bulk.replaceTags", "태그 교체")}
                </button>
              </div>
            </section>
          ) : null}

          <section className="mb-10 border-4 border-foreground bg-card p-4">
            <div className="flex items-center gap-2 mb-4 font-mono text-xs font-bold uppercase">
              <Tag className="w-4 h-4" /> {t("library.tagManager", "Tag Manager")}
            </div>
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <input
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                placeholder={t("library.newTag", "new tag")}
                className="min-h-[44px] bg-background border-2 border-foreground text-foreground px-4 py-2 font-mono text-sm w-full md:w-auto flex-1"
              />
              <button
                type="button"
                onClick={() => createTag.mutate(newTagName.trim())}
                disabled={!newTagName.trim() || createTag.isPending}
                className="min-h-[44px] flex items-center justify-center px-4 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground w-full md:w-auto"
              >
                {createTag.isPending ? <LoadingDots /> : t("library.create", "Create")}
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {(tags.data?.data ?? []).map((tag) => (
                <div key={tag.id} className="min-h-[44px] inline-flex items-center justify-between gap-3 border-2 border-foreground pl-3 pr-1 py-1 bg-background flex-grow md:flex-grow-0">
                  {editingTagId === tag.id ? (
                    <input
                      value={editingTagName}
                      onChange={(event) => setEditingTagName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitRenameTag(tag.id)
                        if (event.key === "Escape") setEditingTagId(null)
                      }}
                      onBlur={() => submitRenameTag(tag.id)}
                      autoFocus
                      className="bg-background border-b-2 border-foreground font-mono text-xs font-bold w-[120px] focus:outline-none"
                    />
                  ) : (
                    <span className="font-mono text-xs font-bold truncate max-w-[150px]">#{tag.name}</span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleRenameTag(tag)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center font-mono text-[10px] font-bold uppercase border border-transparent hover:border-foreground hover:bg-muted"
                    >
                      {t("library.tagEdit", "편집")}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTag.mutate(tag.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center font-mono text-[10px] font-bold uppercase border border-transparent hover:border-foreground hover:bg-muted"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {createTag.error ? <p className="font-mono text-xs text-destructive mt-2">{createTag.error.message}</p> : null}
            {renameTag.error ? <p className="font-mono text-xs text-destructive mt-2">{renameTag.error.message}</p> : null}
            {deleteTag.error ? <p className="font-mono text-xs text-destructive mt-2">{deleteTag.error.message}</p> : null}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {records.isLoading ? (
              <>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-48 md:h-72 w-full" />
                ))}
              </>
            ) : null}

            {!records.isLoading && (allRecords).map((record) => (
              <div
                key={record.id}
                onMouseEnter={() => prefetchRecord(record.id)}
                onFocus={() => prefetchRecord(record.id)}
                className="group flex h-48 flex-col border-4 border-foreground bg-card p-4 md:p-6 shadow-brutal hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none transition-all md:h-72"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(record.id)}
                      onChange={() => toggleSelect(record.id)}
                      className="min-h-[32px] min-w-[32px] md:min-h-[44px] md:min-w-[44px] border-2 border-foreground"
                    />
                    <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase h-fit mt-1">
                      {record.kind}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold border-2 px-1.5 py-0.5 uppercase h-fit mt-1 ${record.state === "INBOX"
                        ? "border-accent text-accent group-hover:border-background group-hover:text-background"
                        : "border-current"
                        }`}
                    >
                      {getStateLabel(record.state, t)}
                    </span>
                  </div>

                  {record.state === "INBOX" && (
                    <button
                      onClick={(event) => {
                        event.preventDefault()
                        activate.mutate(record.id)
                      }}
                      className="text-accent group-hover:text-white p-2 md:p-0 mt-[-8px] md:mt-0"
                      title="ACTIVATE"
                      type="button"
                      disabled={activate.isPending}
                    >
                      {activate.isPending && activate.variables === record.id ? (
                        <LoadingSpinner className="w-6 h-6" />
                      ) : (
                        <Play className="w-6 h-6 md:w-5 md:h-5" strokeWidth={3} />
                      )}
                    </button>
                  )}
                </div>

                <Link href={`/records/${record.id}`} className="flex-1 overflow-hidden flex flex-col">
                  <p className="font-bold text-base md:text-lg leading-tight line-clamp-5 flex-1 mb-4">
                    {stripMarkdown(record.content)}
                  </p>

                  {record.source_title && (
                    <div className="mt-auto flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold text-muted-foreground group-hover:text-background/70 truncate border-t-2 border-border/50 group-hover:border-background/30 pt-2">
                      {record.favicon_url && (
                        <img
                          src={record.favicon_url}
                          alt=""
                          width={12}
                          height={12}
                          className="w-3 h-3 flex-shrink-0 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                      )}
                      {record.source_title}
                    </div>
                  )}
                </Link>
              </div>
            ))}
          </div>

          {cursor ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                className="min-h-[44px] border-4 border-foreground bg-background px-8 py-3 font-mono text-sm font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm transition-colors"
              >
                {t("library.loadMore", "더 불러오기")} ↓
              </button>
            </div>
          ) : null}

          {records.isSuccess && !records.isLoading && allRecords.length === 0 ? (
            <EmptyState
              title={t("library.noResults", "0 RESULTS FOUND.")}
              actionLabel={t("library.goCapture", "Go capture")}
              actionHref="/capture"
            />
          ) : null}

          {records.error ? <ErrorState message={records.error.message} onRetry={() => records.refetch()} /> : null}
          {exportError ? (
            <ErrorState message={`${t("library.exportError", "EXPORT ERR")}: ${exportError}`} />
          ) : null}
        </main>
      </AuthGate>
    </div>
  )
}
