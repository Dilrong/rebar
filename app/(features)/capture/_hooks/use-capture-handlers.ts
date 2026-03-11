import type { ChangeEvent } from "react"
import type { UseMutationResult } from "@tanstack/react-query"
import type { IngestItemInput } from "../_lib/external-import"
import { parseExternalItems } from "../_lib/external-import"
import { parseCsvItems, parseCsvPreview, type CsvPreview } from "../_lib/csv-import"

type IngestResponse = {
  created: number
  ids: string[]
}

type UseCaptureHandlersOptions = {
  t: (key: string, fallback?: string) => string
  externalJson: string
  csvText: string
  ocrFile: File | null
  ingestMutation: UseMutationResult<IngestResponse, Error, { items: IngestItemInput[]; import_channel?: "csv" | "json" }, unknown>
  enqueueRetryMutation: UseMutationResult<{ id: string }, Error, { items: IngestItemInput[]; import_channel: "csv" | "json"; error?: string }, unknown>
  ocrMutation: UseMutationResult<string, Error, File, unknown>
  setIngestResult: (value: IngestResponse | null) => void
  setIngestError: (value: string | null) => void
  setPendingIngestCount: (value: number | null) => void
  closeToast: () => void
  setCsvFileName: (value: string | null) => void
  setCsvText: (value: string) => void
  setCsvPreview: (value: CsvPreview) => void
  setOcrFile: (value: File | null) => void
  setOcrFileName: (value: string | null) => void
}

export function useCaptureHandlers(options: UseCaptureHandlersOptions) {
  const handleIngestSubmit = () => {
    options.setIngestResult(null)
    options.setIngestError(null)
    options.closeToast()

    try {
      const items = parseExternalItems(options.externalJson)
      if (items.length === 0) {
        throw new Error(options.t("capture.ingestEmpty", "No importable items found."))
      }

      options.setPendingIngestCount(items.length)
      options.ingestMutation.mutate(
        { items, import_channel: "json" },
        {
          onError: (error) =>
            options.enqueueRetryMutation.mutate({
              items,
              import_channel: "json",
              error: error instanceof Error ? error.message : "Ingest failed"
            })
        }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : options.t("capture.ingestParseError", "Invalid JSON")
      options.setIngestError(message)
      options.setPendingIngestCount(null)
    }
  }

  const handleCsvSubmit = () => {
    options.setIngestResult(null)
    options.setIngestError(null)
    options.closeToast()

    try {
      const items = parseCsvItems(options.csvText)
      if (items.length === 0) {
        throw new Error(options.t("capture.csvEmpty", "No importable rows found."))
      }

      options.setPendingIngestCount(items.length)
      options.ingestMutation.mutate(
        { items, import_channel: "csv" },
        {
          onError: (error) =>
            options.enqueueRetryMutation.mutate({
              items,
              import_channel: "csv",
              error: error instanceof Error ? error.message : "Ingest failed"
            })
        }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : options.t("capture.csvParseError", "Invalid CSV")
      options.setIngestError(message)
      options.setPendingIngestCount(null)
    }
  }

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    options.setCsvFileName(file.name)
    const text = await file.text()
    options.setCsvText(text)
    options.setCsvPreview(parseCsvPreview(text))
  }

  const handleOcrFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    options.setOcrFile(file)
    options.setOcrFileName(file.name)
    options.setIngestError(null)
  }

  const handleOcrSubmit = () => {
    options.setIngestError(null)
    options.closeToast()
    if (!options.ocrFile) {
      options.setIngestError(options.t("capture.ocrNoFile", "Select an image first"))
      return
    }

    options.ocrMutation.mutate(options.ocrFile)
  }

  return {
    handleIngestSubmit,
    handleCsvSubmit,
    handleCsvFileChange,
    handleOcrFileChange,
    handleOcrSubmit
  }
}
