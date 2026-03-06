import type { ChangeEvent } from "react"

type CsvPreview = {
  totalRows: number
  importableRows: number
  readwiseDetected: boolean
}

type CaptureCsvSectionProps = {
  t: (key: string, fallback?: string) => string
  csvFileName: string | null
  csvPreview: CsvPreview
  ingestPending: boolean
  ingestPendingCount: number | null
  ingestError: string | null
  ingestMutationError: string | null
  ingestResultCreated: number | null
  canSubmit: boolean
  onCsvFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
}

export function CaptureCsvSection({
  t,
  csvFileName,
  csvPreview,
  ingestPending,
  ingestPendingCount,
  ingestError,
  ingestMutationError,
  ingestResultCreated,
  canSubmit,
  onCsvFileChange,
  onSubmit
}: CaptureCsvSectionProps) {
  return (
    <section className="mb-8 border-2 border-foreground p-4 bg-background/60">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase">{t("capture.csvTitle", "CSV IMPORT")}</p>
      </div>
      <label htmlFor="capture-csv-file" className="mb-2 block font-mono text-xs font-bold uppercase text-foreground">
        {t("capture.csvFile", "CSV FILE")}
      </label>
      <input
        id="capture-csv-file"
        type="file"
        accept=".csv,text/csv"
        onChange={onCsvFileChange}
        className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 font-mono text-xs rounded-none shadow-brutal-sm focus:outline-none focus:ring-0 cursor-pointer focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:border-4 file:border-foreground file:text-xs file:font-bold file:uppercase file:bg-foreground file:text-background hover:file:bg-background hover:file:text-foreground file:transition-all file:duration-200 file:cursor-pointer"
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
          onClick={onSubmit}
          disabled={!canSubmit || ingestPending}
          className="min-h-[44px] w-full sm:w-auto flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1"
        >
          {ingestPending ? t("capture.csvImporting", "IMPORTING...") : t("capture.csvRun", "IMPORT CSV")}
        </button>
      </div>
      {ingestPending && ingestPendingCount !== null ? (
        <p className="mt-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
          {t("capture.ingestProgress", "PROCESSING ITEMS")}: {ingestPendingCount}
        </p>
      ) : null}
      {ingestError ? <p className="mt-2 font-mono text-xs text-destructive">{ingestError}</p> : null}
      {ingestMutationError ? <p className="mt-2 font-mono text-xs text-destructive">{ingestMutationError}</p> : null}
      {ingestResultCreated !== null ? (
        <p className="mt-2 font-mono text-xs text-foreground">
          {t("capture.ingestDone", "Imported")}: {ingestResultCreated}
        </p>
      ) : null}
    </section>
  )
}
