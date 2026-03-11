"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { AnnotationRow, RecordNoteVersionRow, RecordRow, TagRow } from "@/lib/types"
import { Link as LinkIcon, Hash as HashIcon, ArrowLeftSquare, History, SlidersHorizontal } from "lucide-react"
import { LoadingSpinner } from "@shared/ui/loading"
import { Toast } from "@shared/ui/toast"
import { BottomSheet } from "@shared/ui/bottom-sheet"
import { ConfirmDialog } from "../_components/confirm-dialog"
import { MarkdownContent } from "@shared/ui/markdown-content"
import { RecordManagePanel } from "../_components/record-manage-panel"
import { RecordTagsPanel } from "../_components/record-tags-panel"
import { RecordHistoryPanel } from "../_components/record-history-panel"
import { ArticleReader } from "../_components/article-reader"
import { RecordHighlightPopup } from "../_components/record-highlight-popup"
import { useRecordDerivedState } from "../_hooks/use-record-derived-state"
import { useRecordDetailMutations } from "../_hooks/use-record-detail-mutations"
import { useRecordEditorState } from "../_hooks/use-record-editor-state"
import { useRecordNavigation } from "../_hooks/use-record-navigation"
import { useRecordPanels } from "../_hooks/use-record-panels"
import { useSelectionPopup } from "../_hooks/use-selection-popup"

type DetailResponse = {
  record: RecordRow
  annotations: AnnotationRow[]
  note_versions: RecordNoteVersionRow[]
  tags: Pick<TagRow, "id" | "name">[]
}

type TagsResponse = {
  data: TagRow[]
}

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
  const [showUpdateToast, setShowUpdateToast] = useState(false)
  const [showDeleteToast, setShowDeleteToast] = useState(false)
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false)
  const [pendingTrashConfirm, setPendingTrashConfirm] = useState(false)
  const [lastStateBeforeDelete, setLastStateBeforeDelete] = useState<RecordRow["state"]>("INBOX")
  const [redirectTimer, setRedirectTimer] = useState<number | null>(null)
  const [newTagName, setNewTagName] = useState("")
  const articleRef = useRef<HTMLDivElement>(null)
  const { isDesktopViewport, desktopPanel, mobilePanel, togglePanel, closeMobilePanel } = useRecordPanels()
  const { goBack } = useRecordNavigation({ id, backHref, router })

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

  const { isArticleReader, selectedTagIds, markdownHighlights } = useRecordDerivedState({
    record: detail.data?.record,
    annotations: detail.data?.annotations,
    tags: detail.data?.tags
  })
  const { selectionPopup, setSelectionPopup } = useSelectionPopup({
    articleRef,
    disabled: isArticleReader,
    maxChars: MAX_HIGHLIGHT_ANCHOR_CHARS
  })
  const { addHighlight, deleteAnnotation, updateTags, createTag, updateRecord, updateNote, deleteRecord } = useRecordDetailMutations({
    id,
    queryClient,
    router,
    setSelectionPopup,
    setNewTagName,
    selectedTagIds,
    setShowUpdateToast,
    setShowDeleteToast,
    setRedirectTimer
  })
  const { editUrl, setEditUrl, editSourceTitle, setEditSourceTitle, editState, setEditState, editNote, setEditNote, requestSaveRecord, quickArchive, requestSaveNote, undoDelete } = useRecordEditorState({
    detail: detail.data,
    updateRecord,
    updateNote,
    redirectTimer,
    setRedirectTimer,
    setShowDeleteToast
  })
  const requestSaveRecordWithConfirm = useCallback(() => {
    requestSaveRecord(() => setPendingTrashConfirm(true))
  }, [requestSaveRecord])
  const handleUndoDelete = useCallback(() => {
    undoDelete(lastStateBeforeDelete)
  }, [lastStateBeforeDelete, undoDelete])

  const isRecordMutating = updateRecord.isPending || deleteRecord.isPending
  const isTagMutating = updateTags.isPending || createTag.isPending

  const handleHighlightClick = useCallback(
    (highlightId: string) => {
      if (window.confirm(t("record.removeHighlight", "Remove this highlight?"))) {
        deleteAnnotation.mutate(highlightId)
      }
    },
    [deleteAnnotation, t]
  )

  const toggleTag = useCallback((tagId: string) => {
    const current = detail.data?.tags.map((tag) => tag.id) ?? []
    const next = current.includes(tagId)
      ? current.filter((idItem) => idItem !== tagId)
      : [...current, tagId]

    updateTags.mutate(next)
  }, [detail.data?.tags, updateTags])

  const requestDeleteRecord = useCallback(() => {
    setPendingDeleteConfirm(true)
  }, [])

  const panelContent = useMemo(() => ({
    manage: (
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
        onRequestSave={requestSaveRecordWithConfirm}
        onRequestDelete={requestDeleteRecord}
      />
    ),
    tags: (
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
    ),
    history: (
      <RecordHistoryPanel
        t={t}
        annotations={detail.data?.annotations ?? []}
        noteVersions={detail.data?.note_versions ?? []}
        updateRecordError={updateRecord.error?.message ?? null}
        deleteRecordError={deleteRecord.error?.message ?? null}
      />
    )
  }), [
    createTag,
    deleteRecord.error?.message,
    deleteRecord.isPending,
    detail.data?.annotations,
    detail.data?.note_versions,
    editSourceTitle,
    editState,
    editUrl,
    isRecordMutating,
    isTagMutating,
    newTagName,
    requestDeleteRecord,
    requestSaveRecordWithConfirm,
    selectedTagIds,
    t,
    tags.data?.data,
    toggleTag,
    updateRecord.error?.message,
    updateRecord.isPending,
    updateTags,
    updateTags.error?.message
  ])

  return (
    <>
      <AuthGate>
        <ProtectedPageShell rootClassName="selection:bg-accent selection:text-white md:p-6" mainClassName="max-w-5xl pb-32">

          <div className="mb-4 mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-[44px] w-full items-center justify-center border-2 border-transparent px-2 py-1 text-sm font-black uppercase text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background sm:w-auto sm:justify-start"
              >
                <ArrowLeftSquare className="w-5 h-5 mr-2" strokeWidth={2.5} /> {t("record.back", "BACK")}
              </button>
            </div>

            <div className="flex gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => togglePanel("manage")}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={2.5} />
                MANAGE
              </button>
              <button
                type="button"
                onClick={() => togglePanel("tags")}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <HashIcon className="h-4 w-4" strokeWidth={2.5} />
                TAGS
              </button>
              <button
                type="button"
                onClick={() => togglePanel("history")}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <History className="h-4 w-4" strokeWidth={2.5} />
                LOG
              </button>
            </div>
          </div>

          {detail.isLoading && (
            <div className="flex flex-col items-center justify-center space-y-4 p-16 text-foreground md:p-32">
              <LoadingSpinner className="w-12 h-12 text-accent" />
              <p className="font-mono text-xs font-bold uppercase text-muted-foreground animate-pulse">{t("record.syncing", "Syncing block data...")}</p>
            </div>
          )}

          {detail.data && (
            <div className={`grid grid-cols-1 gap-6 ${isDesktopViewport ? (desktopPanel ? "lg:grid-cols-[minmax(0,1fr)_72px_minmax(280px,360px)]" : "lg:grid-cols-[minmax(0,1fr)_72px]") : ""}`}>
              <div className="flex flex-col gap-8">
                <article className="relative border-4 border-foreground bg-card p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] md:p-10">
                  <div className="flex flex-wrap gap-2 mb-8 border-b-4 border-foreground pb-4">
                    <span className="font-mono text-xs font-bold bg-foreground text-background px-2 py-0.5 uppercase">ID:{detail.data.record.id.substring(0, 8)}</span>
                    <span className="font-mono text-xs font-bold border-2 border-foreground text-foreground px-2 py-0.5 uppercase">TYPE:{detail.data.record.kind}</span>
                    <span className="font-mono text-xs font-bold border-2 border-accent text-accent px-2 py-0.5 uppercase">
                      {t("record.state", "STATE")}:{getStateLabel(detail.data.record.state, t)}
                    </span>
                  </div>

                  {detail.data.record.source_title && (
                    <h1 className="mb-6 inline-flex max-w-full break-words bg-accent px-3 py-1 text-2xl font-black uppercase leading-tight text-white md:text-3xl">
                      {detail.data.record.source_title}
                    </h1>
                  )}

                  <div ref={articleRef} className="relative">
                    {isArticleReader ? (
                      <ArticleReader
                        content={detail.data.record.content}
                        highlights={markdownHighlights}
                        onHighlightClick={handleHighlightClick}
                        onSelectionChange={setSelectionPopup}
                      />
                    ) : (
                      <MarkdownContent
                        content={detail.data.record.content}
                        className="text-lg leading-[1.6] sm:text-xl md:text-2xl"
                        highlights={markdownHighlights}
                        onHighlightClick={handleHighlightClick}
                      />
                    )}
                  </div>

                  <div className="mt-8 border-t-4 border-border pt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                        {t("record.currentNote", "CURRENT NOTE")}
                      </p>
                      <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                        {updateNote.isPending ? t("record.pending", "SAVING...") : "CMD+ENTER / BLUR"}
                      </p>
                    </div>
                    <textarea
                      value={editNote}
                      onChange={(event) => setEditNote(event.target.value)}
                      onBlur={requestSaveNote}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          event.preventDefault()
                          requestSaveNote()
                          event.currentTarget.blur()
                        }
                      }}
                      placeholder={t("record.annotation.placeholder", "ENTER NOTE")}
                      className="min-h-[160px] w-full resize-y border-4 border-foreground bg-background p-4 text-base leading-[1.7] text-foreground focus:outline-none focus:ring-0"
                    />
                    {updateNote.error ? (
                      <p className="mt-2 font-mono text-[10px] font-bold uppercase text-destructive">
                        {updateNote.error.message}
                      </p>
                    ) : null}
                  </div>

                  {detail.data.record.url && (
                    <div className="mt-10 pt-6 border-t-4 border-border">
                      <a href={detail.data.record.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] w-full items-center justify-center border-2 border-foreground bg-muted px-3 py-2 font-mono text-sm font-bold uppercase text-foreground transition-colors hover:bg-foreground hover:text-background sm:w-auto sm:justify-start">
                        <LinkIcon className="w-4 h-4 mr-2" strokeWidth={3} />
                        {t("record.externalLink", "EXTERNAL_LINK")}
                      </a>
                    </div>
                  )}

                  {detail.data.tags && detail.data.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-6 flex-wrap">
                      <HashIcon className="w-5 h-5 text-accent" strokeWidth={3} />
                      {detail.data.tags.map((tag: Pick<TagRow, "id" | "name">) => (
                        <span key={tag.id} className="font-mono text-xs font-bold uppercase border-b-2 border-foreground text-foreground animate-scale-in">
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
                        className="flex w-full items-center justify-center gap-3 border-4 border-foreground bg-background px-6 py-4 text-center text-lg font-black uppercase text-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-accent hover:text-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:px-10 sm:text-xl md:w-auto"
                      >
                        {updateRecord.isPending ? "ARCHIVING..." : (
                          <><span>{t("record.quickArchive", "ARCHIVE DOCUMENT")}</span> <ArrowLeftSquare className="w-6 h-6 rotate-180" strokeWidth={3} /></>
                        )}
                      </button>
                    </div>
                  )}
                </article>
              </div>

              <aside className="hidden lg:flex lg:flex-col lg:gap-3 lg:pt-2">
                <button
                  type="button"
                  onClick={() => togglePanel("manage")}
                  className={`inline-flex min-h-[56px] items-center justify-center border-4 border-foreground bg-background shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none ${desktopPanel === "manage" ? "bg-foreground text-background" : ""}`}
                  aria-label="Manage"
                >
                  <SlidersHorizontal className="h-5 w-5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => togglePanel("tags")}
                  className={`inline-flex min-h-[56px] items-center justify-center border-4 border-foreground bg-background shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none ${desktopPanel === "tags" ? "bg-foreground text-background" : ""}`}
                  aria-label="Tags"
                >
                  <HashIcon className="h-5 w-5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => togglePanel("history")}
                  className={`inline-flex min-h-[56px] items-center justify-center border-4 border-foreground bg-background shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none ${desktopPanel === "history" ? "bg-foreground text-background" : ""}`}
                  aria-label="History"
                >
                  <History className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </aside>

              {desktopPanel ? (
                <section className="hidden lg:block">
                  {panelContent[desktopPanel]}
                </section>
              ) : null}
            </div>
          )}
          {detail.error ? (
            <div className="bg-destructive text-destructive-foreground p-4 font-mono text-xs font-bold uppercase border-4 border-foreground mt-6">
              ERR: {detail.error.message}
            </div>
          ) : null}
        </ProtectedPageShell>
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
      onAction={handleUndoDelete}
          onClose={() => setShowDeleteToast(false)}
        />
      ) : null}
      <RecordHighlightPopup
        open={Boolean(selectionPopup)}
        x={selectionPopup?.x ?? 0}
        y={selectionPopup?.y ?? 0}
        pending={addHighlight.isPending}
        label={t("record.highlight", "HIGHLIGHT")}
        onConfirm={() => {
          if (selectionPopup) {
            addHighlight.mutate({ body: selectionPopup.text, anchor: selectionPopup.anchor })
          }
        }}
      />
      <BottomSheet
        open={Boolean(mobilePanel)}
        title={mobilePanel === "manage" ? "MANAGE" : mobilePanel === "tags" ? "TAGS" : "LOG HISTORY"}
        onClose={closeMobilePanel}
      >
        {mobilePanel ? panelContent[mobilePanel] : null}
      </BottomSheet>
    </>
  )
}
