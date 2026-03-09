"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { apiFetch } from "@/lib/client-http"
import { CreateRecordSchema, type CreateRecordInput } from "@/lib/schemas"
import type { RecordRow, TagRow } from "@/lib/types"
import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useForm } from "react-hook-form"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { Toast } from "@shared/ui/toast"
import { parseExternalItems, type IngestItemInput } from "./_lib/external-import"
import { CaptureImportModeTabs } from "./_components/capture-import-mode-tabs"
import { CaptureUrlSection } from "./_components/capture-url-section"
import { CaptureCsvSection } from "./_components/capture-csv-section"
import { CaptureOcrSection } from "./_components/capture-ocr-section"
import { CaptureManualForm } from "./_components/capture-manual-form"
import { CaptureBatchSection } from "./_components/capture-batch-section"

type TagsResponse = {
  data: TagRow[]
}

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

type IngestJobRow = {
  id: string
  status: "PENDING" | "DONE" | "FAILED"
  attempts: number
  last_error: string | null
  created_at: string
}

type IngestJobsResponse = {
  data: IngestJobRow[]
  total: number
}

type CsvPreview = {
  totalRows: number
  importableRows: number
  readwiseDetected: boolean
}

type ImportMode = "manual" | "url" | "batch" | "csv" | "ocr"
type CaptureToastKind = "ingested" | "ocrFilled" | "retryDone"

const TOAST_DURATION_MS = 5000

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index]

    if (ch === '"') {
      const next = line[index + 1]
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }

    current += ch
  }

  cells.push(current.trim())
  return cells
}

function normalizeCsvHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) {
      continue
    }

    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  return ""
}

function parseCsvItems(raw: string): IngestItemInput[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalizeCsvHeader(header))
  const items: IngestItemInput[] = []

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line)
    const row = new Map<string, string>()

    headers.forEach((header, index) => {
      row.set(header, values[index] ?? "")
    })

    const highlight = firstNonEmpty(row.get("content"), row.get("text"), row.get("highlight"))
    const note = firstNonEmpty(row.get("note"))
    const content = highlight || note

    if (!content) {
      continue
    }

    const tagsRaw = row.get("tags") ?? ""
    const tags = tagsRaw
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    const bookTitle = firstNonEmpty(row.get("booktitle"), row.get("title"), row.get("sourcetitle"))
    const bookAuthor = firstNonEmpty(row.get("bookauthor"), row.get("author"))
    const url = firstNonEmpty(row.get("url"), row.get("sourceurl"))

    const rawKind = firstNonEmpty(row.get("kind")).toLowerCase()
    const kind: IngestItemInput["kind"] | undefined =
      rawKind === "quote" || rawKind === "note" || rawKind === "link" || rawKind === "ai"
        ? rawKind
        : highlight
          ? "quote"
          : "note"

    const item: IngestItemInput = {
      content,
      note: highlight && note ? note : undefined,
      source_title: !bookTitle && !bookAuthor ? firstNonEmpty(row.get("title"), row.get("sourcetitle")) || undefined : undefined,
      book_title: bookTitle || undefined,
      book_author: bookAuthor || undefined,
      url: url || undefined,
      kind,
      source_type: bookTitle || bookAuthor ? "book" : url ? "article" : "unknown",
      tags: tags.length > 0 ? tags : undefined
    }

    items.push(item)
  }

  return items
}

function parseCsvPreview(raw: string): CsvPreview {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { totalRows: 0, importableRows: 0, readwiseDetected: false }
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalizeCsvHeader(header))
  const readwiseDetected = ["highlight", "booktitle", "bookauthor", "amazonbookid", "highlightedat"].every((key) =>
    headers.includes(key)
  )

  let importableRows = 0
  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line)
    const row = new Map<string, string>()

    headers.forEach((header, index) => {
      row.set(header, values[index] ?? "")
    })

    const highlight = firstNonEmpty(row.get("content"), row.get("text"), row.get("highlight"))
    const note = firstNonEmpty(row.get("note"))
    if (highlight || note) {
      importableRows += 1
    }
  }

  return {
    totalRows: Math.max(lines.length - 1, 0),
    importableRows,
    readwiseDetected
  }
}

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

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10 // 10 minutes
  })

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
      form.setValue("content", data.description ?? data.content)
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

  const ingestJobs = useQuery({
    queryKey: ["ingest-jobs", "pending"],
    queryFn: () => apiFetch<IngestJobsResponse>("/api/ingest-jobs?status=PENDING"),
    staleTime: 1000 * 30 // 30 seconds
  })

  const enqueueRetryMutation = useMutation({
    mutationFn: (payload: { items: IngestItemInput[]; error?: string }) =>
      apiFetch<{ id: string }>("/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { items: payload.items }, error: payload.error })
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

  const retryAllMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ done: number; failed: number; pending: number }>("/api/ingest-jobs/retry", {
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
    <div className="min-h-screen flex flex-col bg-background p-4 font-sans selection:bg-accent selection:text-white md:p-6">
      <AuthGate>
        <main className="max-w-5xl w-full mx-auto animate-fade-in-up pb-24">
          <AppNav />

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
                pendingJobsTotal={ingestJobs.data?.total ?? 0}
                retryAllPending={retryAllMutation.isPending}
                clearRetryPending={clearRetryMutation.isPending}
                onRetryAll={() => retryAllMutation.mutate()}
                onClearRetry={() => clearRetryMutation.mutate()}
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
        </main>
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
    </div>
  )
}
