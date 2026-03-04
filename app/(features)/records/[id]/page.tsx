"use client"

import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useEffect, useRef, useState, useCallback } from "react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { AnnotationRow, RecordRow, TagRow } from "@/lib/types"
import { Link as LinkIcon, Hash, ArrowLeftSquare } from "lucide-react"
import Link from "next/link"
import { LoadingSpinner } from "@shared/ui/loading"
import { Toast } from "@shared/ui/toast"
import { ConfirmDialog } from "../_components/confirm-dialog"
import { MarkdownContent } from "@shared/ui/markdown-content"

type DetailResponse = {
  record: RecordRow
  annotations: AnnotationRow[]
  tags: Pick<TagRow, "id" | "name">[]
}

type TagsResponse = {
  data: TagRow[]
}

type AssistResponse = {
  data: {
    summary: string[]
    questions: string[]
    todos: string[]
    signals: {
      topKeywords: string[]
    }
  }
}

type AnnotationInput = {
  kind: "highlight" | "comment" | "correction"
  body: string
  anchor?: string
}

type SelectionPopup = {
  x: number
  y: number
  text: string
} | null

export default function RecordDetailPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editUrl, setEditUrl] = useState("")
  const [editSourceTitle, setEditSourceTitle] = useState("")
  const [editState, setEditState] = useState<RecordRow["state"]>("INBOX")
  const [showUpdateToast, setShowUpdateToast] = useState(false)
  const [showDeleteToast, setShowDeleteToast] = useState(false)
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false)
  const [pendingTrashConfirm, setPendingTrashConfirm] = useState(false)
  const [lastStateBeforeDelete, setLastStateBeforeDelete] = useState<RecordRow["state"]>("INBOX")
  const [redirectTimer, setRedirectTimer] = useState<number | null>(null)
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopup>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [newTagName, setNewTagName] = useState("")
  const [checkedAssistTodos, setCheckedAssistTodos] = useState<string[]>([])
  const [showAssistCopiedToast, setShowAssistCopiedToast] = useState(false)
  const articleRef = useRef<HTMLDivElement>(null)

  const detail = useQuery({
    queryKey: ["record-detail", id],
    queryFn: () => apiFetch<DetailResponse>(`/api/records/${id}`),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10 // 10 minutes
  })

  const form = useForm<AnnotationInput>({
    defaultValues: { kind: "comment", body: "" }
  })

  const addAnnotation = useMutation({
    mutationFn: (payload: AnnotationInput) =>
      apiFetch(`/api/records/${id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      form.reset({ kind: "comment", body: "" })
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
    }
  })

  const addHighlight = useMutation({
    mutationFn: (anchor: string) =>
      apiFetch(`/api/records/${id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "highlight", body: anchor, anchor })
      }),
    onSuccess: () => {
      setSelectionPopup(null)
      window.getSelection()?.removeAllRanges()
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
    }
  })

  const deleteAnnotation = useMutation({
    mutationFn: (annotationId: string) =>
      apiFetch(`/api/records/${id}/annotations/${annotationId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
    }
  })

  const assist = useMutation({
    mutationFn: () =>
      apiFetch<AssistResponse>(`/api/records/${id}/assist`, {
        method: "POST"
      }),
    onSuccess: () => {
      setCheckedAssistTodos([])
    }
  })

  // Text selection handler for highlight toolbar
  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !articleRef.current) {
      setSelectionPopup(null)
      return
    }
    const text = sel.toString().trim()
    if (text.length < 3) { setSelectionPopup(null); return }

    // Only allow selection inside the article
    const range = sel.getRangeAt(0)
    if (!articleRef.current.contains(range.commonAncestorContainer)) {
      setSelectionPopup(null)
      return
    }

    const rect = range.getBoundingClientRect()
    setSelectionPopup({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text
    })
  }, [])

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelect)
    document.addEventListener("touchend", handleTextSelect)
    return () => {
      document.removeEventListener("mouseup", handleTextSelect)
      document.removeEventListener("touchend", handleTextSelect)
    }
  }, [handleTextSelect])

  const updateTags = useMutation({
    mutationFn: (tagIds: string[]) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: tagIds })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
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
    onSuccess: (res) => {
      setNewTagName("")
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      // Automatically toggle the new tag on
      const nextTags = [...Array.from(selectedTagIds), res.tag.id]
      updateTags.mutate(nextTags)
    }
  })

  const updateRecord = useMutation({
    mutationFn: (payload: { url: string; source_title: string; state: RecordRow["state"] }) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      setShowUpdateToast(true)
      window.setTimeout(() => setShowUpdateToast(false), 2500)
    }
  })

  const deleteRecord = useMutation({
    mutationFn: () =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      setShowDeleteToast(true)
      const timer = window.setTimeout(() => {
        router.replace("/library")
      }, 4000)
      setRedirectTimer(timer)
    }
  })

  const selectedTagIds = new Set((detail.data?.tags ?? []).map((tag) => tag.id))

  const toggleTag = (tagId: string) => {
    const current = detail.data?.tags.map((tag) => tag.id) ?? []
    const next = current.includes(tagId)
      ? current.filter((idItem) => idItem !== tagId)
      : [...current, tagId]

    updateTags.mutate(next)
  }

  useEffect(() => {
    if (!detail.data) {
      return
    }

    setEditUrl(detail.data.record.url ?? "")
    setEditSourceTitle(detail.data.record.source_title ?? "")
    setEditState(detail.data.record.state)
  }, [detail.data])

  useEffect(() => {
    return () => {
      if (redirectTimer) {
        window.clearTimeout(redirectTimer)
      }
    }
  }, [redirectTimer])

  const requestSaveRecord = () => {
    if (editState === "TRASHED" && detail.data?.record.state !== "TRASHED") {
      setPendingTrashConfirm(true)
      return
    }

    updateRecord.mutate({
      source_title: editSourceTitle,
      url: editUrl,
      state: editState
    })
  }

  const quickArchive = () => {
    updateRecord.mutate({
      source_title: detail.data?.record.source_title ?? "",
      url: detail.data?.record.url ?? "",
      state: "ARCHIVED"
    })
  }

  const requestDeleteRecord = () => {
    setPendingDeleteConfirm(true)
  }

  const undoDelete = () => {
    if (redirectTimer) {
      window.clearTimeout(redirectTimer)
      setRedirectTimer(null)
    }

    setShowDeleteToast(false)
    updateRecord.mutate({
      source_title: editSourceTitle,
      url: editUrl,
      state: lastStateBeforeDelete
    })
  }

  const toggleAssistTodo = (todo: string) => {
    setCheckedAssistTodos((current) =>
      current.includes(todo)
        ? current.filter((item) => item !== todo)
        : [...current, todo]
    )
  }

  const copyAssistTodos = async () => {
    const todos = assist.data?.data.todos ?? []
    if (todos.length === 0) {
      return
    }

    const markdown = todos
      .map((todo) => `- [${checkedAssistTodos.includes(todo) ? "x" : " "}] ${todo}`)
      .join("\n")

    await navigator.clipboard.writeText(markdown)
    setShowAssistCopiedToast(true)
    window.setTimeout(() => setShowAssistCopiedToast(false), 2000)
  }

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <AuthGate>
        <main className="max-w-5xl mx-auto animate-fade-in-up pb-32">
          <AppNav />

          <div className="mb-4 mt-4 flex justify-between gap-4">
            <Link href="/library" className="inline-flex items-center text-sm font-black uppercase text-foreground hover:bg-foreground hover:text-background border-2 border-transparent hover:border-foreground px-2 py-1 transition-colors self-start">
              <ArrowLeftSquare className="w-5 h-5 mr-2" strokeWidth={2.5} /> {t("record.back", "BACK")}
            </Link>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="inline-flex items-center font-mono text-sm font-bold text-foreground bg-muted hover:bg-foreground hover:text-background border-2 border-foreground px-3 py-1 transition-colors uppercase shadow-brutal-sm"
            >
              {isSidebarOpen ? "CLOSE SIDEBAR" : "OPEN SIDEBAR"}
            </button>
          </div>

          {detail.isLoading && (
            <div className="flex flex-col items-center justify-center p-32 text-foreground space-y-4">
              <LoadingSpinner className="w-12 h-12 text-accent" />
              <p className="font-mono text-xs font-bold uppercase text-muted-foreground animate-pulse">{t("record.syncing", "Syncing block data...")}</p>
            </div>
          )}

          {detail.data && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className={`flex flex-col gap-8 ${isSidebarOpen ? "lg:col-span-8" : "lg:col-span-12"}`}>
                <article className="border-4 border-foreground bg-card p-6 md:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] relative">
                  <div className="flex flex-wrap gap-2 mb-8 border-b-4 border-foreground pb-4">
                    <span className="font-mono text-xs font-bold bg-foreground text-background px-2 py-0.5 uppercase">ID:{detail.data.record.id.substring(0, 8)}</span>
                    <span className="font-mono text-xs font-bold border-2 border-foreground text-foreground px-2 py-0.5 uppercase">TYPE:{detail.data.record.kind}</span>
                    <span className="font-mono text-xs font-bold border-2 border-accent text-accent px-2 py-0.5 uppercase">
                      {t("record.state", "STATE")}:{getStateLabel(detail.data.record.state, t)}
                    </span>
                  </div>

                  {detail.data.record.source_title && (
                    <h1 className="text-2xl md:text-3xl font-black text-foreground mb-6 uppercase leading-tight bg-accent text-white inline-block px-3 py-1">
                      {detail.data.record.source_title}
                    </h1>
                  )}

                  <div ref={articleRef} className="relative">
                    <MarkdownContent
                      content={detail.data.record.content}
                      className="text-xl md:text-2xl leading-[1.6]"
                      highlights={
                        (detail.data.annotations ?? [])
                          .filter(a => a.kind === "highlight" && a.anchor)
                          .map(a => ({ id: a.id, anchor: a.anchor! }))
                      }
                      onHighlightClick={(hlId) => {
                        if (window.confirm(t("record.removeHighlight", "Remove this highlight?"))) {
                          deleteAnnotation.mutate(hlId)
                        }
                      }}
                    />
                  </div>

                  {detail.data.record.url && (
                    <div className="mt-10 pt-6 border-t-4 border-border">
                      <a href={detail.data.record.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center font-mono text-sm font-bold text-foreground bg-muted hover:bg-foreground hover:text-background px-3 py-2 border-2 border-foreground transition-colors uppercase">
                        <LinkIcon className="w-4 h-4 mr-2" strokeWidth={3} />
                        {t("record.externalLink", "EXTERNAL_LINK")}
                      </a>
                    </div>
                  )}

                  {detail.data.tags && detail.data.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-6 flex-wrap">
                      <Hash className="w-5 h-5 text-accent" strokeWidth={3} />
                      {detail.data.tags.map((tag: Pick<TagRow, "id" | "name">) => (
                        <span key={tag.id} className="font-mono text-xs font-bold uppercase border-b-2 border-foreground text-foreground">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {detail.data.record.state !== "ARCHIVED" && (
                    <div className="mt-16 flex justify-center border-t-4 border-dashed border-border pt-12">
                      <button
                        type="button"
                        onClick={quickArchive}
                        disabled={updateRecord.isPending}
                        className="bg-background text-foreground hover:bg-accent hover:text-white font-black text-xl px-10 py-5 uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-foreground transition-all flex items-center justify-center gap-3 w-full md:w-auto"
                      >
                        {updateRecord.isPending ? "ARCHIVING..." : (
                          <><span>{t("record.quickArchive", "ARCHIVE DOCUMENT")}</span> <ArrowLeftSquare className="w-6 h-6 rotate-180" strokeWidth={3} /></>
                        )}
                      </button>
                    </div>
                  )}
                </article>
              </div>

              {isSidebarOpen && (
                <section className="lg:col-span-4 flex flex-col gap-6">
                  <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                    <h3 className="font-black text-xl uppercase text-foreground mb-4 border-b-4 border-foreground pb-2">
                      {t("record.assist.title", "AI EXECUTION")}
                    </h3>
                    <button
                      type="button"
                      onClick={() => assist.mutate()}
                      disabled={assist.isPending}
                      className="min-h-[44px] w-full border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background disabled:opacity-60"
                    >
                      {assist.isPending
                        ? t("record.assist.running", "GENERATING...")
                        : t("record.assist.run", "GENERATE SUMMARY + TODO")}
                    </button>

                    {assist.error ? (
                      <p className="mt-3 font-mono text-xs text-destructive">{assist.error.message}</p>
                    ) : null}

                    {assist.data ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                            {t("record.assist.summary", "SUMMARY")}
                          </p>
                          <div className="space-y-2">
                            {assist.data.data.summary.map((item) => (
                              <p key={item} className="border-2 border-foreground bg-background p-2 font-mono text-xs font-bold">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                            {t("record.assist.questions", "KEY QUESTIONS")}
                          </p>
                          <div className="space-y-2">
                            {assist.data.data.questions.map((item) => (
                              <p key={item} className="border border-foreground bg-background p-2 font-mono text-xs">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                              {t("record.assist.todos", "ACTION TODOS")}
                            </p>
                            <button
                              type="button"
                              onClick={copyAssistTodos}
                              className="min-h-[36px] border border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background"
                            >
                              {t("record.assist.copyTodos", "COPY")}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {assist.data.data.todos.map((todo) => {
                              const checked = checkedAssistTodos.includes(todo)
                              return (
                                <button
                                  key={todo}
                                  type="button"
                                  onClick={() => toggleAssistTodo(todo)}
                                  className={`min-h-[44px] w-full border-2 px-3 py-2 text-left font-mono text-xs font-bold transition-colors ${
                                    checked
                                      ? "border-foreground bg-foreground text-background"
                                      : "border-foreground bg-background text-foreground hover:bg-muted"
                                  }`}
                                >
                                  <span className="mr-2">{checked ? "[x]" : "[ ]"}</span>
                                  {todo}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {assist.data.data.signals.topKeywords.length > 0 ? (
                          <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                            {t("record.assist.keywords", "KEYWORDS")}: {assist.data.data.signals.topKeywords.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                    <h3 className="font-black text-xl uppercase text-foreground mb-4 flex items-center justify-between border-b-4 border-foreground pb-2">
                      <span className="flex items-center gap-2"><ArrowLeftSquare className="w-6 h-6 rotate-180" strokeWidth={3} /> {t("record.manageRecord", "MANAGE")}</span>
                    </h3>
                    <div className="space-y-3">
                      <input
                        value={editSourceTitle}
                        onChange={(event) => setEditSourceTitle(event.target.value)}
                        placeholder="SOURCE TITLE"
                        className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <input
                        value={editUrl}
                        onChange={(event) => setEditUrl(event.target.value)}
                        placeholder="https://..."
                        className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <select
                        value={editState}
                        onChange={(event) => setEditState(event.target.value as RecordRow["state"])}
                        className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs font-bold uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer rounded-none"
                      >
                        <option value="INBOX">{getStateLabel("INBOX", t)}</option>
                        <option value="ACTIVE">{getStateLabel("ACTIVE", t)}</option>
                        <option value="PINNED">{getStateLabel("PINNED", t)}</option>
                        <option value="ARCHIVED">{getStateLabel("ARCHIVED", t)}</option>
                        <option value="TRASHED">{getStateLabel("TRASHED", t)}</option>
                      </select>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={requestSaveRecord}
                          disabled={updateRecord.isPending}
                          className="min-h-[44px] flex-1 bg-foreground text-background font-black text-xs uppercase py-2 hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                        >
                          {updateRecord.isPending ? "..." : t("record.update", "UPDATE")}
                        </button>
                        <button
                          type="button"
                          onClick={requestDeleteRecord}
                          disabled={deleteRecord.isPending}
                          className="min-h-[44px] flex-1 bg-destructive text-white font-black text-xs uppercase py-2 hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {deleteRecord.isPending ? "..." : t("record.delete", "DELETE")}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-black text-xl uppercase text-foreground mb-4 flex items-center gap-2 border-b-4 border-foreground pb-2">
                      <Hash className="w-6 h-6" strokeWidth={3} /> {t("record.tagsEdit", "TAGS")}
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(tags.data?.data ?? []).length === 0 && (
                        <span className="font-mono text-xs text-muted-foreground uppercase">{t("record.noTagsAvail", "NO TAGS AVAILABLE")}</span>
                      )}
                      {(tags.data?.data ?? [])
                        .filter((tag: TagRow) => selectedTagIds.has(tag.id))
                        .map((tag: TagRow) => (
                          <div
                            key={tag.id}
                            className="flex items-center border-2 border-foreground bg-foreground text-background font-mono text-xs font-bold uppercase transition-transform hover:scale-105"
                          >
                            <span className="px-2 py-1">#{tag.name}</span>
                            <button
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              disabled={updateTags.isPending}
                              className="px-2 py-1 border-l-2 border-background/20 hover:bg-destructive hover:text-white transition-colors"
                              aria-label="Remove tag"
                            >
                              X
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Select for unassigned tags */}
                    {(() => {
                      const unassignedTags = (tags.data?.data ?? []).filter((tag: TagRow) => !selectedTagIds.has(tag.id))
                      if (unassignedTags.length === 0) return null

                      return (
                        <select
                          onChange={(e) => {
                            if (e.target.value) toggleTag(e.target.value)
                            e.target.value = "" // Reset after selection
                          }}
                          disabled={updateTags.isPending}
                          className="w-full bg-background border-2 border-dashed border-foreground/50 text-foreground font-mono text-xs font-bold p-2 focus:outline-none focus:border-accent appearance-none rounded-none cursor-pointer uppercase"
                          defaultValue=""
                        >
                          <option value="" disabled>+ {t("record.addTag", "ADD TAG...")}</option>
                          {unassignedTags.map((tag: TagRow) => (
                            <option key={tag.id} value={tag.id}>{tag.name}</option>
                          ))}
                        </select>
                      )
                    })()}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (newTagName.trim()) createTag.mutate(newTagName.trim())
                      }}
                      className="mt-4 flex gap-0"
                    >
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="+ NEW TAG"
                        className="flex-1 bg-background border-2 border-r-0 border-foreground font-mono text-xs font-bold p-2 focus:outline-none focus:border-accent uppercase min-w-0 placeholder:text-muted-foreground/50"
                      />
                      <button
                        type="submit"
                        disabled={!newTagName.trim() || createTag.isPending}
                        className="bg-foreground text-background font-mono text-xs font-bold px-3 py-2 uppercase hover:bg-accent hover:text-white disabled:opacity-50 border-2 border-foreground"
                      >
                        {createTag.isPending ? "..." : "ADD"}
                      </button>
                    </form>

                    {updateTags.error ? (
                      <p className="font-mono text-xs text-destructive mt-3">{updateTags.error.message}</p>
                    ) : null}
                  </div>

                  <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">

                    {updateRecord.error ? <p className="font-mono text-xs text-destructive">{updateRecord.error.message}</p> : null}
                    {deleteRecord.error ? <p className="font-mono text-xs text-destructive">{deleteRecord.error.message}</p> : null}

                    <div className="flex flex-col gap-4">
                      <h2 className="font-black text-2xl text-foreground uppercase pt-4 px-2">{t("record.logHistory", "LOG.HISTORY")}</h2>

                      {detail.data.annotations.length === 0 && (
                        <p className="font-mono text-sm font-bold text-muted-foreground uppercase border-2 border-dashed border-border p-4 text-center">{t("record.noLogs", "NO LOGS FOUND.")}</p>
                      )}

                      <div className="space-y-4">
                        {detail.data.annotations.map(ann => (
                          <div key={ann.id} className="border-2 border-foreground bg-background p-4 relative shadow-[2px_2px_0px_0px_theme(colors.accent)]">
                            <span className="inline-block bg-accent text-white font-mono text-[10px] font-bold px-1.5 py-0.5 uppercase mb-2">
                              {ann.kind}
                            </span>
                            <p className="text-foreground font-medium text-sm whitespace-pre-wrap">{ann.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
          {detail.error ? (
            <div className="bg-destructive text-white p-4 font-mono text-xs font-bold uppercase border-4 border-foreground mt-6">
              ERR: {detail.error.message}
            </div>
          ) : null}
        </main>
      </AuthGate>
      <ConfirmDialog
        open={pendingDeleteConfirm}
        title={t("confirm.deleteTitle", "Delete record?")}
        description={t("confirm.deleteDesc", "The item will move to trash. You can undo for a short time.")}
        confirmLabel={t("confirm.delete", "Delete")}
        cancelLabel={t("confirm.cancel", "Cancel")}
        onCancel={() => setPendingDeleteConfirm(false)}
        onConfirm={() => {
          setPendingDeleteConfirm(false)
          setLastStateBeforeDelete(detail.data?.record.state ?? "INBOX")
          deleteRecord.mutate()
        }}
      />
      <ConfirmDialog
        open={pendingTrashConfirm}
        title={t("confirm.trashTitle", "Move to trash?")}
        description={t("confirm.trashDesc", "This item will be hidden from normal lists.")}
        confirmLabel={t("confirm.move", "Move")}
        cancelLabel={t("confirm.cancel", "Cancel")}
        onCancel={() => setPendingTrashConfirm(false)}
        onConfirm={() => {
          setPendingTrashConfirm(false)
          updateRecord.mutate({
            source_title: editSourceTitle,
            url: editUrl,
            state: "TRASHED"
          })
        }}
      />
      {showUpdateToast ? (
        <Toast
          message={t("toast.updated", "Updated")}
          tone="success"
          onClose={() => setShowUpdateToast(false)}
        />
      ) : null}
      {showDeleteToast ? (
        <Toast
          message={t("toast.deleted", "Moved to trash")}
          actionLabel={t("toast.undo", "Undo")}
          onAction={undoDelete}
          onClose={() => setShowDeleteToast(false)}
        />
      ) : null}
      {showAssistCopiedToast ? (
        <Toast
          message={t("record.assist.copied", "Copied action todos")}
          tone="success"
          onClose={() => setShowAssistCopiedToast(false)}
        />
      ) : null}
      {selectionPopup ? (
        <div
          style={{
            position: "fixed",
            left: `${selectionPopup.x}px`,
            top: `${selectionPopup.y}px`,
            transform: "translate(-50%, -100%)",
            zIndex: 9999
          }}
        >
          <button
            type="button"
            onClick={() => addHighlight.mutate(selectionPopup.text)}
            disabled={addHighlight.isPending}
            className="flex items-center gap-2 border-4 border-foreground bg-yellow-400 text-black px-4 py-2 font-mono text-xs font-black uppercase shadow-brutal-sm hover:bg-yellow-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all whitespace-nowrap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
            </svg>
            {addHighlight.isPending ? "..." : t("record.highlight", "HIGHLIGHT")}
          </button>
        </div>
      ) : null}
    </div>
  )
}
