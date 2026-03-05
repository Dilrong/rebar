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
        className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 font-mono text-xs rounded-none shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-0 cursor-pointer"
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
          className="min-h-[44px] w-full sm:w-auto flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm"
        >
          {ingestPending ? t("capture.csvImporting", "IMPORTING...") : t("capture.csvRun", "IMPORT CSV")}
        </button>
      </div>
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
