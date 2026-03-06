"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { AnnotationRow, RecordRow, TagRow } from "@/lib/types"
import { Link as LinkIcon, Hash, ArrowLeftSquare } from "lucide-react"
import { LoadingSpinner } from "@shared/ui/loading"
import { Toast } from "@shared/ui/toast"
import { ConfirmDialog } from "../_components/confirm-dialog"
import { MarkdownContent } from "@shared/ui/markdown-content"
import { RecordAssistPanel } from "../_components/record-assist-panel"
import { RecordManagePanel } from "../_components/record-manage-panel"
import { RecordTagsPanel } from "../_components/record-tags-panel"
import { RecordHistoryPanel } from "../_components/record-history-panel"

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

const MAX_HIGHLIGHT_ANCHOR_CHARS = 500

function resolveFromPath(value: string | null): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return null
  }

  return normalized
}

export default function RecordDetailPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const backHref = resolveFromPath(searchParams.get("from"))
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
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !articleRef.current) {
      setSelectionPopup(null)
      return
    }

    const text = sel.toString().trim()
    if (text.length < 3 || text.length > MAX_HIGHLIGHT_ANCHOR_CHARS) {
      setSelectionPopup(null)
      return
    }

    // Only allow selection inside the article
    let range: Range
    try {
      range = sel.getRangeAt(0)
    } catch {
      setSelectionPopup(null)
      return
    }

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
    onMutate: async (tagIds) => {
      await queryClient.cancelQueries({ queryKey: ["record-detail", id] })

      const previousDetail = queryClient.getQueryData<DetailResponse>(["record-detail", id])
      const allTags = queryClient.getQueryData<TagsResponse>(["tags"])?.data ?? []

      const nextTags = allTags
        .filter((tag) => tagIds.includes(tag.id))
        .map((tag) => ({ id: tag.id, name: tag.name }))

      queryClient.setQueryData<DetailResponse>(["record-detail", id], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          tags: nextTags
        }
      })

      return {
        previousDetail
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["record-detail", id], context.previousDetail)
      }
    },
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
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["record-detail", id] })

      const previousDetail = queryClient.getQueryData<DetailResponse>(["record-detail", id])

      queryClient.setQueryData<DetailResponse>(["record-detail", id], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          record: {
            ...current.record,
            url: payload.url || null,
            source_title: payload.source_title || null,
            state: payload.state,
            updated_at: new Date().toISOString()
          }
        }
      })

      return {
        previousDetail
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["record-detail", id], context.previousDetail)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      setShowUpdateToast(true)
      window.setTimeout(() => setShowUpdateToast(false), 5000)
    }
  })

  const deleteRecord = useMutation({
    mutationFn: () =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "DELETE"
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["record-detail", id] })
      const previousDetail = queryClient.getQueryData<DetailResponse>(["record-detail", id])

      queryClient.setQueryData<DetailResponse>(["record-detail", id], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          record: {
            ...current.record,
            state: "TRASHED",
            updated_at: new Date().toISOString()
          }
        }
      })

      return {
        previousDetail
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["record-detail", id], context.previousDetail)
      }
    },
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
  const markdownHighlights = useMemo(
    () =>
      (detail.data?.annotations ?? [])
        .filter((annotation) => annotation.kind === "highlight" && annotation.anchor)
        .map((annotation) => ({ id: annotation.id, anchor: annotation.anchor! })),
    [detail.data?.annotations]
  )
  const isRecordMutating = updateRecord.isPending || deleteRecord.isPending
  const isTagMutating = updateTags.isPending || createTag.isPending

  const handleHighlightClick = useCallback(
    (highlightId: string) => {
      if (window.confirm(t("record.removeHighlight", "Remove this highlight?"))) {
        deleteAnnotation.mutate(highlightId)
      }
    },
    [deleteAnnotation.mutate, t]
  )

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
            <button
              type="button"
              onClick={() => {
                if (backHref) {
                  router.push(backHref)
                  return
                }

                router.back()
              }}
              className="inline-flex min-h-[44px] items-center text-sm font-black uppercase text-foreground hover:bg-foreground hover:text-background border-2 border-transparent hover:border-foreground px-2 py-1 transition-colors self-start"
            >
              <ArrowLeftSquare className="w-5 h-5 mr-2" strokeWidth={2.5} /> {t("record.back", "BACK")}
            </button>

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
                      highlights={markdownHighlights}
                      onHighlightClick={handleHighlightClick}
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
                        disabled={isRecordMutating}
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
                  <RecordAssistPanel
                    t={t}
                    pending={assist.isPending}
                    errorMessage={assist.error?.message ?? null}
                    data={assist.data?.data ?? null}
                    checkedTodos={checkedAssistTodos}
                    onRun={() => assist.mutate()}
                    onToggleTodo={toggleAssistTodo}
                    onCopyTodos={copyAssistTodos}
                  />

                  <RecordManagePanel
                    t={t}
                    editSourceTitle={editSourceTitle}
                    editUrl={editUrl}
                    editState={editState}
                    isRecordMutating={isRecordMutating}
                    updatePending={updateRecord.isPending}
                    deletePending={deleteRecord.isPending}
                    onEditSourceTitleChange={setEditSourceTitle}
                    onEditUrlChange={setEditUrl}
                    onEditStateChange={setEditState}
                    onRequestSave={requestSaveRecord}
                    onRequestDelete={requestDeleteRecord}
                  />

                  <RecordTagsPanel
                    t={t}
                    tags={tags.data?.data ?? []}
                    selectedTagIds={selectedTagIds}
                    newTagName={newTagName}
                    isTagMutating={isTagMutating}
                    updateTagsError={updateTags.error?.message ?? null}
                    createTagPending={createTag.isPending}
                    onToggleTag={toggleTag}
                    onNewTagNameChange={setNewTagName}
                    onCreateTag={() => createTag.mutate(newTagName.trim())}
                  />

                  <RecordHistoryPanel
                    t={t}
                    annotations={detail.data.annotations}
                    updateRecordError={updateRecord.error?.message ?? null}
                    deleteRecordError={deleteRecord.error?.message ?? null}
                  />
                </section>
              )}
            </div>
          )}
          {detail.error ? (
            <div className="bg-destructive text-destructive-foreground p-4 font-mono text-xs font-bold uppercase border-4 border-foreground mt-6">
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
