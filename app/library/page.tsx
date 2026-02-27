"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, Download, Play, Search, Tag, Trash2 } from "lucide-react"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { apiFetch } from "@/lib/client-http"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading"
import { useI18n } from "@/components/i18n/i18n-provider"
import { getStateLabel } from "@/lib/i18n/state-label"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"

import type { RecordRow, TagRow } from "@/lib/types"

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
  const [exportPending, setExportPending] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

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

  const records = useQuery({
    queryKey: ["records", queryString, sort, order],
    queryFn: () => apiFetch<RecordsResponse>(`/api/records?${queryString}`)
  })

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags")
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
        } catch {}
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

  const handleRenameTag = (tag: TagRow) => {
    const nextName = window.prompt(t("library.renameTagPrompt", "New tag name"), tag.name)
    if (!nextName || nextName.trim() === tag.name) {
      return
    }
    renameTag.mutate({ id: tag.id, name: nextName.trim() })
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
            <span className="font-mono text-sm font-bold bg-foreground text-background px-3 py-1 uppercase">
              {t("library.rows", "ROWS")}: {records.data?.total || 0}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={exportPending}
                className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exportPending ? t("library.exporting", "EXPORTING...") : `${t("library.export", "EXPORT")} ▾`}
              </button>
              {exportMenuOpen ? (
                <div className="absolute right-0 z-20 mt-1 min-w-[180px] border-2 border-foreground bg-background">
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false)
                      handleExport("markdown")
                    }}
                    className="block w-full border-b border-foreground px-3 py-2 text-left font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false)
                      handleExport("obsidian")
                    }}
                    className="block w-full px-3 py-2 text-left font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
                  >
                    Obsidian (frontmatter)
                  </button>
                </div>
              ) : null}
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase border-2 border-foreground px-3 py-1 bg-background hover:bg-foreground hover:text-background"
            >
              <Search className="w-4 h-4" /> SEARCH
            </Link>
          </div>
        </header>

        <section className="mb-8 border-4 border-foreground bg-card p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              key="ALL"
              type="button"
              onClick={() => setState("ALL")}
              className={`px-3 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase ${
                state === "ALL" ? "bg-foreground text-background" : "bg-background text-foreground"
              }`}
            >
              {t("library.allView", "전체보기")}
            </button>
            {STATE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setState(tab)}
                className={`px-3 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase ${
                  state === tab ? "bg-foreground text-background" : "bg-background text-foreground"
                }`}
              >
                {getStateLabel(tab, t)}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("library.searchPlaceholder", "Search content/title")}
              className="bg-background border-2 border-foreground text-foreground px-3 py-2 font-mono text-sm"
            />
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="bg-background border-2 border-foreground text-foreground px-3 py-2 font-mono text-sm"
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
              className="bg-background border-2 border-foreground text-foreground px-3 py-2 font-mono text-sm"
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
              className="bg-background border-2 border-foreground px-3 py-2 font-mono text-sm text-foreground"
            >
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="review_count:desc">Most reviewed</option>
              <option value="due_at:asc">Due soonest</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{t("library.activeFilters", "Active filters")}</span>
            <button
              type="button"
              onClick={() => setState("ALL")}
              className="border border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase"
            >
              {t("library.state", "State")}: {state === "ALL" ? t("library.allView", "전체보기") : getStateLabel(state, t)}
            </button>
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="border border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase"
              >
                {t("library.query", "Search")}: {q} x
              </button>
            ) : null}
            {kind ? (
              <button
                type="button"
                onClick={() => setKind("")}
                className="border border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase"
              >
                {t("library.kind", "Kind")}: {kind} x
              </button>
            ) : null}
            {tagId ? (
              <button
                type="button"
                onClick={() => setTagId("")}
                className="border border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase"
              >
                {t("library.tag", "Tag")}: {selectedTagName ? `#${selectedTagName}` : tagId.slice(0, 6)} x
              </button>
            ) : null}
            {(q || kind || tagId || state !== "ALL") ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="border-2 border-foreground bg-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase text-background"
              >
                {t("library.clearAll", "Clear all")}
              </button>
            ) : null}
          </div>
        </section>

        {selectedIds.length > 0 ? (
          <section className="mb-8 border-4 border-foreground bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs font-bold uppercase">{selectedIds.length} selected</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectVisible} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                  Select visible
                </button>
                <button type="button" onClick={clearSelection} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                  Clear
                </button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => applyBulkState("ACTIVE")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                Activate
              </button>
              <button type="button" onClick={() => applyBulkState("PINNED")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                Pin
              </button>
              <button type="button" onClick={() => applyBulkState("ARCHIVED")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                Archive
              </button>
              <button type="button" onClick={() => applyBulkState("TRASHED")} className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase">
                Trash
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkTagIds[0] ?? ""}
                onChange={(event) => setBulkTagIds(event.target.value ? [event.target.value] : [])}
                className="min-h-[44px] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs"
              >
                <option value="">Tag to apply</option>
                {(tags.data?.data ?? []).map((tag) => (
                  <option key={tag.id} value={tag.id}>#{tag.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => applyBulkTags("add")} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                Add tag
              </button>
              <button type="button" onClick={() => applyBulkTags("replace")} className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase">
                Replace tags
              </button>
            </div>
          </section>
        ) : null}

        <section className="mb-10 border-4 border-foreground bg-card p-4">
          <div className="flex items-center gap-2 mb-3 font-mono text-xs font-bold uppercase">
            <Tag className="w-4 h-4" /> {t("library.tagManager", "Tag Manager")}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              placeholder={t("library.newTag", "new tag")}
              className="bg-background border-2 border-foreground text-foreground px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => createTag.mutate(newTagName.trim())}
              disabled={!newTagName.trim() || createTag.isPending}
              className="px-3 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground"
            >
              {createTag.isPending ? <LoadingDots /> : t("library.create", "Create")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(tags.data?.data ?? []).map((tag) => (
              <div key={tag.id} className="inline-flex items-center gap-2 border-2 border-foreground px-2 py-1">
                <span className="font-mono text-xs font-bold">#{tag.name}</span>
                <button
                  type="button"
                  onClick={() => handleRenameTag(tag)}
                  className="min-h-[44px] min-w-[44px] font-mono text-[10px] font-bold uppercase"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteTag.mutate(tag.id)}
                  className="min-h-[44px] min-w-[44px] font-mono text-[10px] font-bold uppercase"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {createTag.error ? <p className="font-mono text-xs text-destructive mt-2">{createTag.error.message}</p> : null}
          {renameTag.error ? <p className="font-mono text-xs text-destructive mt-2">{renameTag.error.message}</p> : null}
          {deleteTag.error ? <p className="font-mono text-xs text-destructive mt-2">{deleteTag.error.message}</p> : null}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {records.isLoading ? (
            <div className="col-span-full">
              <LoadingState label={t("library.fetching", "Fetching database records...")} />
            </div>
          ) : null}

          {!records.isLoading && (records.data?.data ?? []).map((record) => (
            <article
              key={record.id}
              className="group flex h-64 flex-col border-4 border-foreground bg-card p-5 shadow-brutal hover:bg-foreground hover:text-background transition-colors md:h-72"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(record.id)}
                    onChange={() => toggleSelect(record.id)}
                    className="min-h-[20px] min-w-[20px] border-2 border-foreground"
                  />
                  <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase">
                    {record.kind}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold border-2 px-1.5 py-0.5 uppercase ${
                      record.state === "INBOX"
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
                    className="text-accent group-hover:text-white"
                    title="ACTIVATE"
                    type="button"
                    disabled={activate.isPending}
                  >
                    {activate.isPending && activate.variables === record.id ? (
                      <LoadingSpinner className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" strokeWidth={3} />
                    )}
                  </button>
                )}
              </div>

              <Link href={`/records/${record.id}`} className="flex-1 overflow-hidden flex flex-col">
                <p className="font-bold text-lg leading-tight line-clamp-5 flex-1 mb-4">{record.content}</p>

                {record.source_title && (
                  <div className="mt-auto font-mono text-[10px] uppercase font-bold text-muted-foreground group-hover:text-background/70 truncate border-t-2 border-border/50 group-hover:border-background/30 pt-2">
                    REF: {record.source_title}
                  </div>
                )}
              </Link>
            </article>
          ))}
        </div>

        {records.isSuccess && !records.isLoading && records.data.data.length === 0 ? (
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
