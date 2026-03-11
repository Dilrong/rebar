"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { apiFetch } from "@/lib/client-http"
import { CreateRecordSchema, type CreateRecordInput } from "@/lib/schemas"
import type { RecordRow, TagRow } from "@/lib/types"
import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useForm } from "react-hook-form"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { Toast } from "@shared/ui/toast"
import { parseExternalItems, type IngestItemInput } from "./_lib/external-import"
import { parseCsvItems, parseCsvPreview, type CsvPreview } from "./_lib/csv-import"
import { CaptureImportModeTabs } from "./_components/capture-import-mode-tabs"
import { CaptureUrlSection } from "./_components/capture-url-section"
import { CaptureCsvSection } from "./_components/capture-csv-section"
import { CaptureOcrSection } from "./_components/capture-ocr-section"
import { CaptureManualForm } from "./_components/capture-manual-form"
import { CaptureBatchSection } from "./_components/capture-batch-section"
import { useCaptureQueries } from "./_hooks/use-capture-queries"

type ExtractResponse = {
  url: string
  title: string | null
  description: string | null
  content: string
}

type IngestResponse = {
  created: number
  ids: string[]
}


type ImportMode = "manual" | "url" | "batch" | "csv" | "ocr"
type CaptureToastKind = "ingested" | "ocrFilled" | "retryDone"

const TOAST_DURATION_MS = 5000

export default function CapturePage() {
  const { t } = useI18n()
  const router = useRouter()
  const form = useForm<CreateRecordInput>({
    resolver: zodResolver(CreateRecordSchema),
    defaultValues: {
      kind: "note",
      content: "",
      url: "",
      source_title: ""
    }
  })

  const { tags, ingestJobs } = useCaptureQueries()

  const selectedTagIds = form.watch("tag_ids") ?? []
  const [externalUrl, setExternalUrl] = useState("")
  const [externalJson, setExternalJson] = useState("")
  const [csvText, setCsvText] = useState("")
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<CsvPreview>({ totalRows: 0, importableRows: 0, readwiseDetected: false })
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrFileName, setOcrFileName] = useState<string | null>(null)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [toastKind, setToastKind] = useState<CaptureToastKind>("ingested")
  const [latestSavedRecordId, setLatestSavedRecordId] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [lastSavedPreview, setLastSavedPreview] = useState<string | null>(null)
  const [pendingIngestCount, setPendingIngestCount] = useState<number | null>(null)
  const [ocrProgress, setOcrProgress] = useState<number | null>(null)
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>("manual")
  const [duplicateRecordId, setDuplicateRecordId] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const openToast = (kind: CaptureToastKind, recordId: string | null = null) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    setToastKind(kind)
    setLatestSavedRecordId(recordId)
    setShowSavedToast(true)
    toastTimerRef.current = window.setTimeout(() => {
      setShowSavedToast(false)
      setLatestSavedRecordId(null)
      toastTimerRef.current = null
    }, TOAST_DURATION_MS)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const mutation = useMutation({
    mutationFn: async (payload: CreateRecordInput) =>
      apiFetch<RecordRow>("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          url: payload.url || undefined,
          source_title: payload.source_title || undefined,
          tag_ids: payload.tag_ids && payload.tag_ids.length > 0 ? payload.tag_ids : undefined
        })
      }),
    onSuccess: (createdRecord) => {
      setDuplicateRecordId(null)
      form.reset({ kind: "note", content: "", url: "", source_title: "", tag_ids: [] })
      setSavedCount((current) => current + 1)
      setLastSavedPreview(
        (createdRecord.source_title ?? createdRecord.content).replace(/\s+/g, " ").trim().slice(0, 48) || null
      )
    },
    onError: (error: Error & { status?: number; payload?: unknown }) => {
      if (error.status === 409 && error.payload && typeof error.payload === "object") {
        const payload = error.payload as { record_id?: string | null; data?: { record_id?: string | null } }
        const recordId = payload.record_id ?? payload.data?.record_id ?? null
        setDuplicateRecordId(recordId ?? null)
      }
    }
  })

  const extractMutation = useMutation({
    mutationFn: (url: string) =>
      apiFetch<ExtractResponse>("/api/capture/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      }),
    onSuccess: (data) => {
      form.setValue("kind", "link")
      form.setValue("url", data.url)
      form.setValue("source_title", data.title ?? "")
      form.setValue("content", data.content)
    }
  })

  const ingestMutation = useMutation({
    mutationFn: async (payload: { items: IngestItemInput[]; import_channel?: "csv" | "json" }) =>
      apiFetch<IngestResponse>("/api/capture/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: (data) => {
      setIngestError(null)
      setIngestResult(data)
      setPendingIngestCount(null)
      setExternalJson("")
      setCsvText("")
      setCsvFileName(null)
      setCsvPreview({ totalRows: 0, importableRows: 0, readwiseDetected: false })
      openToast("ingested", data.ids[0] ?? null)
    },
    onError: () => {
      setPendingIngestCount(null)
    }
  })

  const enqueueRetryMutation = useMutation({
    mutationFn: (payload: { items: IngestItemInput[]; import_channel: "csv" | "json"; error?: string }) =>
      apiFetch<{ id: string }>("/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { items: payload.items, import_channel: payload.import_channel }, error: payload.error })
      }),
    onSuccess: () => {
      ingestJobs.refetch()
    }
  })

  const clearRetryMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ cleared: boolean }>("/api/ingest-jobs?status=PENDING", {
        method: "DELETE"
      }),
    onSuccess: () => {
      ingestJobs.refetch()
    }
  })

  const clearFailedRetryMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ cleared: boolean }>("/api/ingest-jobs?status=FAILED", {
        method: "DELETE"
      }),
    onSuccess: () => {
      ingestJobs.refetch()
    }
  })

  const retryAllMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ done: number; failed: number; pending: number }>("/api/ingest-jobs/retry?status=ALL", {
        method: "POST"
      }),
    onSuccess: (data) => {
      ingestJobs.refetch()
      setIngestError(
        data.failed > 0
          ? t("capture.retryPartial", "일부 재시도만 성공했습니다.")
          : t("capture.retryDone", "대기 중이던 인입이 모두 처리되었습니다.")
      )

      if (data.done > 0) {
        openToast("retryDone")
      }
    }
  })

  const ocrMutation = useMutation({
    mutationFn: async (file: File) => {
      setOcrProgress(0)
      const { recognize } = await import("tesseract.js")
      const result = await recognize(file, "kor+eng", {
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            setOcrProgress(Math.round(message.progress * 100))
          }
        }
      })
      return result.data.text.trim()
    },
    onSuccess: (text) => {
      if (!text) {
        setIngestError(t("capture.ocrEmpty", "No text detected"))
        return
      }

      form.setValue("kind", "note")
      form.setValue("content", text)
      setImportMode("manual")
      openToast("ocrFilled")
    },
    onSettled: () => {
      setOcrProgress(null)
    }
  })

  const onSubmit = form.handleSubmit(
    (values) => mutation.mutate(values),
    (errors) => {
      const fieldOrder: Array<keyof CreateRecordInput> = ["content", "kind", "url", "source_title"]
      const firstInvalidField = fieldOrder.find((field) => errors[field])
      if (firstInvalidField) {
        form.setFocus(firstInvalidField)
      }
    }
  )

  const handleMergeDuplicate = () => {
    const values = form.getValues()
    mutation.mutate({ ...values, on_duplicate: "merge" })
  }

  const handleIngestSubmit = () => {
    setIngestResult(null)
    setIngestError(null)
    setLatestSavedRecordId(null)

    try {
      const items = parseExternalItems(externalJson)
      if (items.length === 0) {
        throw new Error(t("capture.ingestEmpty", "No importable items found."))
      }

      setPendingIngestCount(items.length)

      ingestMutation.mutate(
        { items, import_channel: "json" },
        {
          onError: (error) =>
            enqueueRetryMutation.mutate({
              items,
              import_channel: "json",
              error: error instanceof Error ? error.message : "Ingest failed"
            })
        }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : t("capture.ingestParseError", "Invalid JSON")
      setIngestError(message)
      setPendingIngestCount(null)
    }
  }

  const handleCsvSubmit = () => {
    setIngestResult(null)
    setIngestError(null)
    setLatestSavedRecordId(null)

    try {
      const items = parseCsvItems(csvText)
      if (items.length === 0) {
        throw new Error(t("capture.csvEmpty", "No importable rows found."))
      }

      setPendingIngestCount(items.length)

      ingestMutation.mutate(
        { items, import_channel: "csv" },
        {
          onError: (error) =>
            enqueueRetryMutation.mutate({
              items,
              import_channel: "csv",
              error: error instanceof Error ? error.message : "Ingest failed"
            })
        }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : t("capture.csvParseError", "Invalid CSV")
      setIngestError(message)
      setPendingIngestCount(null)
    }
  }

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setCsvFileName(file.name)
    const text = await file.text()
    setCsvText(text)
    setCsvPreview(parseCsvPreview(text))
  }

  const handleOcrFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setOcrFile(file)
    setOcrFileName(file.name)
    setIngestError(null)
  }

  const handleOcrSubmit = () => {
    setIngestError(null)
    setLatestSavedRecordId(null)
    if (!ocrFile) {
      setIngestError(t("capture.ocrNoFile", "Select an image first"))
      return
    }

    ocrMutation.mutate(ocrFile)
  }

  return (
    <>
      <AuthGate>
        <ProtectedPageShell rootClassName="flex flex-col selection:bg-accent selection:text-white md:p-6" mainClassName="max-w-5xl pb-24">

          <div className="border-[3px] md:border-4 border-foreground bg-card p-4 md:p-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
            <header className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-end justify-between border-b-[3px] md:border-b-4 border-foreground pb-4 md:pb-6 gap-4">
              <h1 className="font-black text-3xl md:text-5xl uppercase text-foreground leading-none">
                {t("capture.title", "CAPTURE")}
              </h1>
              <span className="font-mono text-[10px] md:text-xs font-bold bg-foreground text-background px-2 py-1 uppercase w-fit">
                {t("capture.ready", "READY TO ADD")}
              </span>
            </header>

            <CaptureImportModeTabs importMode={importMode} setImportMode={setImportMode} t={t} />

            {importMode === "url" ? (
              <CaptureUrlSection
                t={t}
                externalUrl={externalUrl}
                onExternalUrlChange={setExternalUrl}
                onImport={() => extractMutation.mutate(externalUrl)}
                importPending={extractMutation.isPending}
                importError={extractMutation.error?.message ?? null}
                importSuccess={extractMutation.isSuccess}
              />
            ) : null}

            {importMode === "batch" ? (
              <CaptureBatchSection
                t={t}
                externalJson={externalJson}
                onExternalJsonChange={setExternalJson}
                onRunBatchImport={handleIngestSubmit}
                ingestPending={ingestMutation.isPending}
                ingestPendingCount={pendingIngestCount}
                ingestError={ingestError}
                ingestMutationError={ingestMutation.error?.message ?? null}
                ingestResultCreated={ingestResult?.created ?? null}
                pendingJobsTotal={ingestJobs.data?.counts.pending ?? 0}
                processingJobsTotal={ingestJobs.data?.counts.processing ?? 0}
                failedJobsTotal={ingestJobs.data?.counts.failed ?? 0}
                doneJobsTotal={ingestJobs.data?.counts.done ?? 0}
                recentJobs={ingestJobs.data?.data ?? []}
                retryAllPending={retryAllMutation.isPending}
                clearPendingPending={clearRetryMutation.isPending}
                clearFailedPending={clearFailedRetryMutation.isPending}
                onRetryAll={() => retryAllMutation.mutate()}
                onClearPending={() => clearRetryMutation.mutate()}
                onClearFailed={() => clearFailedRetryMutation.mutate()}
              />
            ) : null}

            {importMode === "csv" ? (
              <CaptureCsvSection
                t={t}
                csvFileName={csvFileName}
                csvPreview={csvPreview}
                ingestPending={ingestMutation.isPending}
                ingestPendingCount={pendingIngestCount}
                ingestError={ingestError}
                ingestMutationError={ingestMutation.error?.message ?? null}
                ingestResultCreated={ingestResult?.created ?? null}
                canSubmit={csvText.trim().length > 0}
                onCsvFileChange={handleCsvFileChange}
                onSubmit={handleCsvSubmit}
              />
            ) : null}

            {importMode === "ocr" ? (
              <CaptureOcrSection
                t={t}
                ocrFileName={ocrFileName}
                hasOcrFile={Boolean(ocrFile)}
                ocrPending={ocrMutation.isPending}
                ocrProgress={ocrProgress}
                ocrError={ocrMutation.error?.message ?? null}
                ingestError={ingestError}
                onOcrFileChange={handleOcrFileChange}
                onSubmit={handleOcrSubmit}
              />
            ) : null}

            {importMode === "manual" ? (
              <CaptureManualForm
                t={t}
                form={form}
                tags={tags.data?.data ?? []}
                selectedTagIds={selectedTagIds}
                savedCount={savedCount}
                lastSavedPreview={lastSavedPreview}
                onSubmit={onSubmit}
                mutationPending={mutation.isPending}
                mutationErrorMessage={mutation.error?.message ?? null}
                duplicateRecordId={duplicateRecordId}
                onMergeDuplicate={handleMergeDuplicate}
              />
            ) : null}
          </div>
        </ProtectedPageShell>
      </AuthGate>
      {showSavedToast ? (
        <Toast
          message={
            toastKind === "ocrFilled"
              ? t("capture.ocrFilledForm", "텍스트를 수동 입력 폼에 채웠습니다")
              : toastKind === "ingested"
                ? t("capture.ingestToastDone", "일괄 가져오기가 완료되었습니다")
              : toastKind === "retryDone"
                ? t("capture.retryDone", "대기 중이던 인입이 모두 처리되었습니다.")
                  : t("capture.ocrFilledForm", "텍스트를 수동 입력 폼에 채웠습니다")
          }
          actionLabel={latestSavedRecordId ? t("toast.openRecord", "Open") : undefined}
          onAction={
            latestSavedRecordId
              ? () => router.push(`/records/${latestSavedRecordId}?from=${encodeURIComponent("/capture")}`)
              : undefined
          }
          tone="success"
          onClose={() => {
            if (toastTimerRef.current) {
              window.clearTimeout(toastTimerRef.current)
              toastTimerRef.current = null
            }
            setShowSavedToast(false)
            setLatestSavedRecordId(null)
          }}
        />
      ) : null}
    </>
  )
}
