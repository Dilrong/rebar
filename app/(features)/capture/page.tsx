"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { apiFetch } from "@/lib/client-http"
import { CreateRecordSchema, type CreateRecordInput } from "@/lib/schemas"
import type { RecordRow, TagRow } from "@/lib/types"
import { useState } from "react"
import type { ChangeEvent } from "react"
import { useForm } from "react-hook-form"
import { AlertTriangle, CheckSquare } from "lucide-react"
import { LoadingSpinner, LoadingDots } from "@shared/ui/loading"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { Toast } from "@shared/ui/toast"

type TagsResponse = {
  data: TagRow[]
}

type ExtractResponse = {
  url: string
  title: string | null
  description: string | null
  content: string
}

type IngestItemInput = {
  content: string
  title?: string
  source_title?: string
  url?: string
  source_url?: string
  tags?: string[]
  kind?: "quote" | "note" | "link" | "ai"
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const result: string[] = []
  for (const tag of value) {
    if (typeof tag === "string") {
      const trimmed = tag.trim()
      if (trimmed) {
        result.push(trimmed)
      }
      continue
    }

    if (isObject(tag)) {
      const name = asString(tag.name)
      if (name) {
        result.push(name)
      }
    }
  }

  return result.length > 0 ? Array.from(new Set(result)) : undefined
}

function toIngestItem(value: unknown): IngestItemInput | null {
  if (typeof value === "string") {
    const content = value.trim()
    return content ? { content } : null
  }

  if (!isObject(value)) {
    return null
  }

  const content =
    asString(value.content) ??
    asString(value.text) ??
    asString(value.highlight) ??
    asString(value.note) ??
    asString(value.summary)

  if (!content) {
    return null
  }

  const item: IngestItemInput = { content }

  const title = asString(value.title) ?? asString(value.source_title) ?? asString(value.book_title)
  if (title) {
    item.source_title = title
  }

  const url = asString(value.url) ?? asString(value.source_url) ?? asString(value.sourceUrl) ?? asString(value.href)
  if (url) {
    item.url = url
  }

  const tags = normalizeTags(value.tags)
  if (tags) {
    item.tags = tags
  }

  return item
}

function parseExternalItems(raw: string): IngestItemInput[] {
  const parsed = JSON.parse(raw) as unknown
  let source: unknown[] = []

  if (Array.isArray(parsed)) {
    source = parsed
  } else if (isObject(parsed)) {
    const highlights = parsed.highlights
    const results = parsed.results
    const items = parsed.items

    if (Array.isArray(highlights)) {
      source = highlights
    } else if (Array.isArray(results)) {
      source = results
    } else if (Array.isArray(items)) {
      source = items
    } else {
      source = [parsed]
    }
  }

  return source.map(toIngestItem).filter((item): item is IngestItemInput => item !== null)
}

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
    const content =
      highlight && note
        ? `${highlight}\n\nNote: ${note}`
        : highlight || note

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
    const sourceTitle =
      bookTitle && bookAuthor
        ? `${bookTitle} - ${bookAuthor}`
        : bookTitle || bookAuthor || ""

    const url = firstNonEmpty(row.get("url"), row.get("sourceurl"))

    const rawKind = firstNonEmpty(row.get("kind")).toLowerCase()
    const kind: IngestItemInput["kind"] | undefined =
      rawKind === "quote" || rawKind === "note" || rawKind === "link" || rawKind === "ai"
        ? rawKind
        : "quote"

    const item: IngestItemInput = {
      content,
      source_title: sourceTitle || undefined,
      url: url || undefined,
      kind,
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
  const [latestSavedRecordId, setLatestSavedRecordId] = useState<string | null>(null)
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>("manual")
  const [duplicateRecordId, setDuplicateRecordId] = useState<string | null>(null)

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
      setLatestSavedRecordId(createdRecord.id)
      form.reset({ kind: "note", content: "", url: "", source_title: "", tag_ids: [] })
      setShowSavedToast(true)
      window.setTimeout(() => setShowSavedToast(false), 2500)
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
    mutationFn: async (payload: { items: IngestItemInput[] }) =>
      apiFetch<IngestResponse>("/api/capture/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: (data) => {
      setIngestError(null)
      setIngestResult(data)
      setLatestSavedRecordId(data.ids[0] ?? null)
      setExternalJson("")
      setCsvText("")
      setCsvFileName(null)
      setCsvPreview({ totalRows: 0, importableRows: 0, readwiseDetected: false })
      setShowSavedToast(true)
      window.setTimeout(() => setShowSavedToast(false), 2500)
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
        setShowSavedToast(true)
        window.setTimeout(() => setShowSavedToast(false), 2500)
      }
    }
  })

  const ocrMutation = useMutation({
    mutationFn: async (file: File) => {
      const { recognize } = await import("tesseract.js")
      const result = await recognize(file, "kor+eng")
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
      setShowSavedToast(true)
      window.setTimeout(() => setShowSavedToast(false), 2500)
    }
  })

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values))

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

      ingestMutation.mutate(
        { items },
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

      ingestMutation.mutate(
        { items },
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
    <div className="min-h-screen flex flex-col p-6 bg-background font-sans selection:bg-accent selection:text-white">
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

            <section className="mb-6 border-b-4 border-foreground pb-0">
              <div className="flex overflow-x-auto overflow-y-hidden flex-nowrap border-2 border-foreground bg-background hide-scrollbar">
                <button
                  type="button"
                  onClick={() => setImportMode("manual")}
                  className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-colors border-r-2 border-foreground ${importMode === "manual" ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
                    }`}
                >
                  {t("capture.modeManual", "MANUAL")}
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("url")}
                  className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-colors border-r-2 border-foreground ${importMode === "url" ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
                    }`}
                >
                  {t("capture.modeUrl", "URL")}
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("batch")}
                  className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-colors border-r-2 border-foreground ${importMode === "batch" ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
                    }`}
                >
                  {t("capture.modeBatch", "BATCH")}
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("csv")}
                  className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-colors border-r-2 border-foreground ${importMode === "csv" ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
                    }`}
                >
                  {t("capture.modeCsv", "CSV")}
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("ocr")}
                  className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-colors border-r-0 ${importMode === "ocr" ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
                    }`}
                >
                  {t("capture.modeOcr", "OCR")}
                </button>
              </div>
            </section>

            {importMode === "url" ? (
              <section className="mb-8 border-2 border-foreground p-4 bg-background/60">
                <p className="font-mono text-xs font-bold uppercase mb-3">{t("capture.quickImport", "QUICK IMPORT FROM URL")}</p>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                    placeholder="https://..."
                    className="min-h-[44px] w-full bg-background border-2 border-foreground text-foreground px-4 py-3 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => extractMutation.mutate(externalUrl)}
                    disabled={!externalUrl || extractMutation.isPending}
                    className="min-h-[44px] px-4 py-3 border-2 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground min-w-[100px] flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
                  >
                    {extractMutation.isPending ? <LoadingDots /> : t("capture.import", "IMPORT")}
                  </button>
                </div>
                {extractMutation.error ? (
                  <p className="font-mono text-xs text-destructive mt-2">{extractMutation.error.message}</p>
                ) : null}
                {extractMutation.isSuccess ? (
                  <p className="font-mono text-xs text-foreground mt-2">
                    {t("capture.importSuccess", "URL metadata loaded into the form.")}
                  </p>
                ) : null}
              </section>
            ) : null}

            {importMode === "batch" ? (
              <section className="mb-8 border-2 border-foreground p-4 bg-background/60">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-bold uppercase">{t("capture.ingestTitle", "READWISE STYLE BATCH IMPORT")}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/api/capture/ingest"
                      className="min-h-[44px] flex items-center justify-center border border-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background transition-colors"
                      target="_blank"
                    >
                      API
                    </Link>
                    <Link
                      href="/api/capture/guide"
                      className="min-h-[44px] flex items-center justify-center border border-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background transition-colors"
                      target="_blank"
                    >
                      {t("capture.guide", "GUIDE")}
                    </Link>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={externalJson}
                  onChange={(event) => setExternalJson(event.target.value)}
                  placeholder={t(
                    "capture.ingestPlaceholder",
                    '[{"content":"...","title":"...","url":"https://...","tags":["book","idea"]}]'
                  )}
                  className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
                />
                <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-bold text-muted-foreground">
                    {t("capture.ingestHint", "Paste JSON array, Readwise-like highlights, or object with highlights/items.")}
                  </p>
                  <button
                    type="button"
                    onClick={handleIngestSubmit}
                    disabled={!externalJson.trim() || ingestMutation.isPending}
                    className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-colors w-full sm:w-auto"
                  >
                    {ingestMutation.isPending ? t("capture.ingesting", "IMPORTING...") : t("capture.ingestRun", "BATCH IMPORT")}
                  </button>
                </div>
                <details className="mt-3 border-2 border-foreground bg-background p-3">
                  <summary className="min-h-[44px] flex items-center cursor-pointer font-mono text-[10px] font-bold uppercase">ADVANCED IMPORT TOOLS</summary>
                  <div className="mt-3 border-2 border-foreground bg-background p-3">
                    <p className="mb-2 font-mono text-[10px] font-bold uppercase">{t("capture.agentTitle", "EXTERNAL AGENT (OPENCLAW) HEADERS")}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {t("capture.agentHint", "Use Authorization Bearer (session) or x-rebar-ingest-key + x-user-id.")}
                    </p>
                    <pre className="mt-2 overflow-x-auto border border-foreground p-2 font-mono text-[10px]">
                      {`POST /api/capture/ingest
x-rebar-ingest-key: <REBAR_INGEST_API_KEY>
x-user-id: <USER_UUID>
content-type: application/json

{"items":[{"content":"...","title":"...","url":"https://..."}]}`}
                    </pre>
                  </div>
                  <div className="mt-3 border-2 border-foreground bg-background p-3">
                    <p className="mb-3 font-mono text-[10px] font-bold uppercase">{t("capture.shareTitle", "SHARE WEBHOOK (KAKAO/TELEGRAM)")}</p>
                    <Link
                      href="/share"
                      className="min-h-[44px] mb-4 inline-flex items-center justify-center border border-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background transition-colors"
                    >
                      {t("capture.sharePage", "OPEN MOBILE SHARE PAGE")}
                    </Link>
                    <pre className="overflow-x-auto border border-foreground p-2 font-mono text-[10px]">
                      {`POST /api/capture/share
x-rebar-ingest-key: <REBAR_INGEST_API_KEY>
x-user-id: <USER_UUID>
content-type: application/json

{"content":"공유 텍스트","title":"공유 제목","url":"https://..."}`}
                    </pre>
                  </div>
                  <div className="mt-3 border-2 border-foreground bg-background p-3">
                    <p className="mb-2 font-mono text-[10px] font-bold uppercase">
                      {t("capture.retryTitle", "INGEST RETRY QUEUE")}: {ingestJobs.data?.total ?? 0}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => retryAllMutation.mutate()}
                        disabled={(ingestJobs.data?.total ?? 0) === 0 || retryAllMutation.isPending}
                        className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase text-background disabled:opacity-60 transition-colors"
                      >
                        {t("capture.retryRun", "RETRY ALL")}
                      </button>
                      <button
                        type="button"
                        onClick={() => clearRetryMutation.mutate()}
                        disabled={(ingestJobs.data?.total ?? 0) === 0 || clearRetryMutation.isPending}
                        className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-4 py-2 font-mono text-[10px] font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-colors"
                      >
                        {t("capture.retryClear", "CLEAR")}
                      </button>
                    </div>
                  </div>
                </details>
                {ingestError ? <p className="mt-2 font-mono text-xs text-destructive">{ingestError}</p> : null}
                {ingestMutation.error ? (
                  <p className="mt-2 font-mono text-xs text-destructive">{ingestMutation.error.message}</p>
                ) : null}
                {ingestResult ? (
                  <p className="mt-2 font-mono text-xs text-foreground">
                    {t("capture.ingestDone", "Imported")}: {ingestResult.created}
                  </p>
                ) : null}
              </section>
            ) : null}

            {importMode === "csv" ? (
              <section className="mb-8 border-2 border-foreground p-4 bg-background/60">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-bold uppercase">{t("capture.csvTitle", "CSV IMPORT")}</p>
                </div>
                <label className="mb-2 block font-mono text-xs font-bold uppercase text-foreground">
                  {t("capture.csvFile", "CSV FILE")}
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="min-h-[44px] w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
                />
                {csvFileName ? (
                  <p className="mt-3 font-mono text-xs text-foreground">
                    {t("capture.csvSelected", "Selected file")}: {csvFileName}
                  </p>
                ) : null}
                {csvFileName ? (
                  <div className="mt-3 border border-foreground p-2 font-mono text-[10px]">
                    <p>
                      {t("capture.csvRows", "Rows")}: {csvPreview.totalRows} / {t("capture.csvImportable", "Importable")}: {csvPreview.importableRows}
                    </p>
                    <p>
                      {t("capture.csvReadwise", "Readwise format")}: {csvPreview.readwiseDetected ? t("common.yes", "Yes") : t("common.no", "No")}
                    </p>
                  </div>
                ) : null}
                <details className="mt-3 border border-foreground p-2">
                  <summary className="min-h-[44px] flex items-center cursor-pointer font-mono text-[10px] font-bold uppercase">
                    {t("capture.csvFormat", "CSV FORMAT EXAMPLE")}
                  </summary>
                  <pre className="mt-2 overflow-x-auto font-mono text-[10px]">
                    {t(
                      "capture.csvPlaceholder",
                      "content,title,url,tags,kind\nexample note,Article title,https://example.com,book|idea,note"
                    )}
                  </pre>
                </details>
                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-bold text-muted-foreground">
                    {t("capture.csvHint", "Header required: content. Optional: title,url,tags,kind")}
                  </p>
                  <button
                    type="button"
                    onClick={handleCsvSubmit}
                    disabled={!csvText.trim() || ingestMutation.isPending}
                    className="min-h-[44px] w-full sm:w-auto flex items-center justify-center border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-colors"
                  >
                    {ingestMutation.isPending ? t("capture.csvImporting", "IMPORTING...") : t("capture.csvRun", "IMPORT CSV")}
                  </button>
                </div>
                {ingestError ? <p className="mt-2 font-mono text-xs text-destructive">{ingestError}</p> : null}
                {ingestMutation.error ? (
                  <p className="mt-2 font-mono text-xs text-destructive">{ingestMutation.error.message}</p>
                ) : null}
                {ingestResult ? (
                  <p className="mt-2 font-mono text-xs text-foreground">
                    {t("capture.ingestDone", "Imported")}: {ingestResult.created}
                  </p>
                ) : null}
              </section>
            ) : null}

            {importMode === "ocr" ? (
              <section className="mb-8 border-2 border-foreground p-4 bg-background/60">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-bold uppercase">{t("capture.ocrTitle", "IMAGE OCR")}</p>
                </div>
                <label className="mb-2 block font-mono text-xs font-bold uppercase text-foreground">
                  {t("capture.ocrFile", "IMAGE FILE")}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleOcrFileChange}
                  className="min-h-[44px] w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
                />
                {ocrFileName ? (
                  <p className="mt-3 font-mono text-xs text-foreground">{t("capture.ocrSelected", "Selected image")}: {ocrFileName}</p>
                ) : null}
                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-bold text-muted-foreground">
                    {t("capture.ocrHint", "Runs locally with free OCR engine (kor+eng).")}
                  </p>
                  <button
                    type="button"
                    onClick={handleOcrSubmit}
                    disabled={!ocrFile || ocrMutation.isPending}
                    className="min-h-[44px] w-full sm:w-auto flex items-center justify-center border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-colors"
                  >
                    {ocrMutation.isPending ? t("capture.ocrRunning", "READING...") : t("capture.ocrRun", "EXTRACT TEXT")}
                  </button>
                </div>
                {ocrMutation.error ? <p className="mt-2 font-mono text-xs text-destructive">{ocrMutation.error.message}</p> : null}
                {ingestError ? <p className="mt-2 font-mono text-xs text-destructive">{ingestError}</p> : null}
              </section>
            ) : null}

            {importMode === "manual" ? (
              <form className="space-y-8" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.dataType", "DATA.TYPE")}`}</label>
                  <div className="relative">
                    <select
                      {...form.register("kind")}
                      className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-4 focus:outline-none focus:ring-4 focus:ring-accent transition-none appearance-none cursor-pointer font-bold uppercase rounded-none"
                    >
                      <option value="quote">{t("capture.kind.quote", "Quote / Highlight")}</option>
                      <option value="note">{t("capture.kind.note", "Personal Note")}</option>
                      <option value="link">{t("capture.kind.link", "Web Link")}</option>
                      <option value="ai">{t("capture.kind.ai", "AI Content")}</option>
                    </select>
                    <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none font-black text-xl">
                      ▼
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.dataPayload", "DATA.PAYLOAD")}`}</label>
                  <textarea
                    rows={6}
                    placeholder={t("capture.contentPlaceholder", "Paste your content")}
                    className="w-full bg-background border-4 border-foreground text-foreground text-lg md:text-xl p-4 focus:outline-none focus:ring-4 focus:ring-accent transition-none resize-y placeholder:text-muted-foreground/50 rounded-none"
                    {...form.register("content")}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-4 border-dashed border-border pt-8">
                  <div className="space-y-2">
                    <label className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.metaUrl", "META.URL")}`}</label>
                    <input
                      placeholder="https://..."
                      className="min-h-[44px] w-full bg-background border-2 border-foreground text-foreground p-3 focus:outline-none focus:ring-2 focus:ring-accent transition-none placeholder:text-muted-foreground/40 font-mono text-sm rounded-none"
                      {...form.register("url")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.metaRef", "META.REF")}`}</label>
                    <input
                      placeholder="SOURCE IDENTIFIER"
                      className="min-h-[44px] w-full bg-background border-2 border-foreground text-foreground p-3 focus:outline-none focus:ring-2 focus:ring-accent transition-none placeholder:text-muted-foreground/40 font-mono text-sm uppercase rounded-none"
                      {...form.register("source_title")}
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t-2 border-border pt-6">
                  <label className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.tags", "TAGS")}`}</label>
                  <div className="flex flex-wrap gap-2">
                    {(tags.data?.data ?? []).map((tag) => {
                      const checked = selectedTagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            const current = form.getValues("tag_ids") ?? []
                            const next = checked
                              ? current.filter((id) => id !== tag.id)
                              : [...current, tag.id]
                            form.setValue("tag_ids", next)
                          }}
                          className={`min-h-[44px] px-4 py-2 border-2 font-mono text-xs font-bold uppercase flex items-center justify-center hover:bg-foreground hover:text-background transition-colors ${checked
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground bg-background text-foreground"
                            }`}
                        >
                          #{tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-6 border-t-4 border-foreground flex flex-col items-start gap-4">
                  {Object.values(form.formState.errors).map((error) => (
                    <div key={error.message} className="flex items-center text-background bg-destructive font-mono text-xs font-bold px-3 py-2 uppercase">
                      <AlertTriangle className="w-4 h-4 mr-2" strokeWidth={3} />
                      ERR: {error.message}
                    </div>
                  ))}

                  {mutation.error && (
                    <div className="flex items-center text-background bg-destructive font-mono text-xs font-bold px-3 py-2 uppercase">
                      <AlertTriangle className="w-4 h-4 mr-2" strokeWidth={3} />
                      SYS.ERR: {mutation.error.message}
                    </div>
                  )}

                  {duplicateRecordId ? (
                    <div className="w-full border-2 border-foreground bg-background p-3">
                      <p className="font-mono text-xs font-bold uppercase text-foreground">
                        {t("capture.duplicateFound", "중복 항목이 있어 병합 저장을 권장합니다.")}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMergeDuplicate}
                          disabled={mutation.isPending}
                          className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold uppercase text-background transition-colors hover:bg-background hover:text-foreground opacity-90"
                        >
                          {t("capture.mergeDuplicate", "중복 병합 저장")}
                        </button>
                        <Link
                          href={`/records/${duplicateRecordId}?from=${encodeURIComponent("/capture")}`}
                          className="min-h-[44px] flex items-center justify-center border-2 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase text-foreground transition-colors hover:bg-foreground hover:text-background"
                        >
                          {t("capture.openExisting", "기존 항목 보기")}
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {mutation.isSuccess && !showSavedToast ? (
                    <div className="flex items-center text-white bg-accent font-mono text-xs font-bold px-3 py-2 uppercase animate-pulse">
                      <CheckSquare className="w-4 h-4 mr-2" strokeWidth={3} />
                      {t("capture.committed", "COMMITTED TO DATABASE.")}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full mt-4 bg-foreground text-background font-black text-xl uppercase py-5 border-4 border-transparent hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
                  >
                    {mutation.isPending ? (
                      <div className="flex items-center justify-center gap-3">
                        <LoadingSpinner className="w-6 h-6" />
                        <span>{t("capture.transmitting", "SAVING...")}</span>
                      </div>
                    ) : t("capture.commit", "SAVE")}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </main>
      </AuthGate>
      {showSavedToast ? (
        <Toast
          message={t("toast.saved", "Saved")}
          actionLabel={latestSavedRecordId ? t("toast.openRecord", "Open") : undefined}
          onAction={
            latestSavedRecordId
              ? () => router.push(`/records/${latestSavedRecordId}?from=${encodeURIComponent("/capture")}`)
              : undefined
          }
          tone="success"
          onClose={() => {
            setShowSavedToast(false)
            setLatestSavedRecordId(null)
          }}
        />
      ) : null}
    </div>
  )
}
