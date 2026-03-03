"use client"

import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useEffect, useState } from "react"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { useI18n } from "@/components/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { AnnotationRow, RecordRow, TagRow } from "@/lib/types"
import { Link as LinkIcon, Hash, ArrowLeftSquare, PlusSquare } from "lucide-react"
import Link from "next/link"
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading"
import { Toast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type DetailResponse = {
  record: RecordRow
  annotations: AnnotationRow[]
  tags: Pick<TagRow, "id" | "name">[]
}

type TagsResponse = {
  data: TagRow[]
}

type AnnotationInput = {
  kind: "highlight" | "comment" | "correction"
  body: string
}

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

  const detail = useQuery({
    queryKey: ["record-detail", id],
    queryFn: () => apiFetch<DetailResponse>(`/api/records/${id}`),
    enabled: Boolean(id)
  })

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags")
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

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <AuthGate>
        <main className="max-w-5xl mx-auto animate-fade-in-up pb-32">
          <AppNav />

          <div className="mb-4 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Link href="/library" className="inline-flex items-center text-sm font-black uppercase text-foreground hover:bg-foreground hover:text-background border-2 border-transparent hover:border-foreground px-2 py-1 transition-colors self-start">
              <ArrowLeftSquare className="w-5 h-5 mr-2" strokeWidth={2.5} /> {t("record.back", "BACK")}
            </Link>

            {detail.data ? (
              <div className="flex flex-col gap-2 border-2 border-foreground bg-card p-3 shadow-brutal-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={editSourceTitle}
                    onChange={(event) => setEditSourceTitle(event.target.value)}
                    placeholder="SOURCE TITLE"
                    className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs text-foreground"
                  />
                  <input
                    value={editUrl}
                    onChange={(event) => setEditUrl(event.target.value)}
                    placeholder="https://..."
                    className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs text-foreground"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={editState}
                    onChange={(event) => setEditState(event.target.value as RecordRow["state"])}
                    className="min-h-[44px] flex-1 border-2 border-foreground bg-background p-2 font-mono text-xs text-foreground"
                  >
                    <option value="INBOX">{getStateLabel("INBOX", t)}</option>
                    <option value="ACTIVE">{getStateLabel("ACTIVE", t)}</option>
                    <option value="PINNED">{getStateLabel("PINNED", t)}</option>
                    <option value="ARCHIVED">{getStateLabel("ARCHIVED", t)}</option>
                    <option value="TRASHED">{getStateLabel("TRASHED", t)}</option>
                  </select>

                  <button
                    type="button"
                    onClick={requestSaveRecord}
                    disabled={updateRecord.isPending}
                    className="min-h-[44px] flex-1 border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background disabled:opacity-60"
                  >
                    {updateRecord.isPending ? t("record.updating", "UPDATING...") : t("record.update", "UPDATE RECORD")}
                  </button>

                  <button
                    type="button"
                    onClick={requestDeleteRecord}
                    disabled={deleteRecord.isPending}
                    className="min-h-[44px] flex-1 border-2 border-foreground bg-destructive px-3 py-2 font-mono text-xs font-bold uppercase text-white disabled:opacity-60"
                  >
                    {deleteRecord.isPending ? t("record.deleting", "DELETING...") : t("record.delete", "DELETE RECORD")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {detail.isLoading && (
            <div className="flex flex-col items-center justify-center p-32 text-foreground space-y-4">
              <LoadingSpinner className="w-12 h-12 text-accent" />
              <p className="font-mono text-xs font-bold uppercase text-muted-foreground animate-pulse">{t("record.syncing", "Syncing block data...")}</p>
            </div>
          )}

          {detail.data && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 flex flex-col gap-8">
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

                  <div className="relative">
                    <div className="font-semibold text-xl md:text-2xl text-foreground leading-[1.6] whitespace-pre-wrap">
                      {detail.data.record.content}
                    </div>
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
                      {detail.data.tags.map(tag => (
                        <span key={tag.id} className="font-mono text-xs font-bold uppercase border-b-2 border-foreground text-foreground">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </div>

              <section className="lg:col-span-4 flex flex-col gap-6">
                <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                  <h3 className="font-black text-xl uppercase text-foreground mb-4 flex items-center gap-2 border-b-4 border-foreground pb-2">
                    <PlusSquare className="w-6 h-6" strokeWidth={3} /> {t("record.appendLog", "APPEND.LOG")}
                  </h3>
                  <form onSubmit={form.handleSubmit(payload => addAnnotation.mutate(payload))} className="space-y-4">
                    <div className="relative">
                      <select
                        {...form.register("kind")}
                        className="w-full bg-background border-2 border-foreground font-mono text-sm font-bold uppercase text-foreground p-3 focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer rounded-none"
                      >
                        <option value="comment">{t("record.annotation.comment", "COMMENT")}</option>
                        <option value="highlight">{t("record.annotation.highlight", "HIGHLIGHT")}</option>
                        <option value="correction">{t("record.annotation.correction", "CORRECTION")}</option>
                      </select>
                    </div>
                    <textarea
                      rows={4}
                      placeholder={t("record.annotation.placeholder", "Enter note")}
                      className="w-full bg-background border-2 border-foreground text-foreground font-mono text-sm p-3 focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted-foreground/50 resize-y rounded-none"
                      {...form.register("body", { required: true })}
                    />
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={addAnnotation.isPending}
                        className="w-full bg-foreground text-background font-black text-sm uppercase py-3 hover:bg-accent hover:text-white transition-colors disabled:opacity-50 border-2 border-transparent rounded-none flex items-center justify-center min-h-[44px]"
                      >
                        {addAnnotation.isPending ? <LoadingDots /> : t("record.execute", "EXECUTE")}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="font-black text-xl uppercase text-foreground mb-4 flex items-center gap-2 border-b-4 border-foreground pb-2">
                    <Hash className="w-6 h-6" strokeWidth={3} /> {t("record.tagsEdit", "TAGS.EDIT")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(tags.data?.data ?? []).map((tag) => {
                      const active = selectedTagIds.has(tag.id)
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          disabled={updateTags.isPending}
                          className={`px-2 py-1 border-2 font-mono text-xs font-bold uppercase ${active
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground bg-background text-foreground"
                            }`}
                        >
                          #{tag.name}
                        </button>
                      )
                    })}
                  </div>
                  {updateTags.error ? (
                    <p className="font-mono text-xs text-destructive mt-3">{updateTags.error.message}</p>
                  ) : null}
                </div>

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
              </section>
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
    </div>
  )
}
