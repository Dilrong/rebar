"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Activity, Database, Download, Play, Search, Tag, Trash2 } from "lucide-react"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { apiFetch } from "@/lib/client-http"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading"
import { useI18n } from "@/components/i18n/i18n-provider"
import { getStateLabel } from "@/lib/i18n/state-label"

import type { RecordRow, TagRow } from "@/lib/types"

type RecordsResponse = {
  data: RecordRow[]
  total: number
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
    return params.toString()
  }, [kind, q, state, tagId])

  const records = useQuery({
    queryKey: ["records", queryString],
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

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set("format", "markdown")
    if (state !== "ALL") {
      params.set("state", state)
    }
    if (tagId) {
      params.set("tag_id", tagId)
    }
    return `/api/export?${params.toString()}`
  }, [state, tagId])

  const handleExport = async () => {
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

      const response = await fetch(exportHref, { headers })
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
      anchor.download = `rebar-export-${today}.md`
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
    const nextName = window.prompt("새 태그 이름", tag.name)
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
            <button
              type="button"
              onClick={handleExport}
              disabled={exportPending}
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase border-2 border-foreground px-3 py-1 bg-background hover:bg-foreground hover:text-background disabled:opacity-60"
            >
              <Download className="w-4 h-4" /> {exportPending ? t("library.exporting", "EXPORTING...") : t("library.export", "EXPORT")}
            </button>
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
                  className="font-mono text-[10px] font-bold uppercase"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteTag.mutate(tag.id)}
                  className="font-mono text-[10px] font-bold uppercase"
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
          {records.isLoading && (
            <div className="col-span-full flex flex-col items-center py-20 border-4 border-dashed border-border">
              <LoadingSpinner className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="font-mono text-xs font-bold uppercase text-muted-foreground">{t("library.fetching", "Fetching database records...")}</p>
            </div>
          )}

          {!records.isLoading && (records.data?.data ?? []).map((record) => (
            <article
              key={record.id}
              className="group flex flex-col border-4 border-foreground bg-card hover:bg-foreground hover:text-background transition-colors p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-64 md:h-72"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
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

        {records.isSuccess && !records.isLoading && records.data.data.length === 0 && (

          <div className="flex flex-col items-center justify-center p-20 border-4 border-dashed border-border mt-8 bg-muted/20">
            <Activity className="w-12 h-12 text-muted-foreground mb-4" strokeWidth={2} />
            <p className="font-black text-2xl uppercase text-muted-foreground">{t("library.noResults", "0 RESULTS FOUND.")}</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={clearAllFilters}
                className="border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase"
              >
                {t("library.clearAll", "Clear all")}
              </button>
              <Link
                href="/capture"
                className="border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background"
              >
                {t("library.goCapture", "Go capture")}
              </Link>
            </div>
          </div>
        )}

        {records.error ? (
          <div className="bg-destructive text-white p-4 font-mono text-xs font-bold uppercase border-4 border-foreground mt-6">
            ERR: {records.error.message}
          </div>
        ) : null}
        {exportError ? (
          <div className="bg-destructive text-white p-4 font-mono text-xs font-bold uppercase border-4 border-foreground mt-6">
            {t("library.exportError", "EXPORT ERR")}: {exportError}
          </div>
        ) : null}
      </main>
      </AuthGate>
    </div>
  )
}
