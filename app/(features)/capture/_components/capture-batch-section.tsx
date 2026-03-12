import Link from "next/link"

type IngestJobListItem = {
  id: string
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED"
  attempts: number
  last_error: string | null
  created_at: string
  item_count: number
  import_channel: string
  preview: string | null
}

type CaptureBatchSectionProps = {
  t: (key: string, fallback?: string) => string
  externalJson: string
  onExternalJsonChange: (value: string) => void
  onRunBatchImport: () => void
  ingestPending: boolean
  ingestPendingCount: number | null
  ingestError: string | null
  ingestMutationError: string | null
  ingestResultCreated: number | null
  pendingJobsTotal: number
  processingJobsTotal: number
  failedJobsTotal: number
  doneJobsTotal: number
  recentJobs: IngestJobListItem[]
  retryAllPending: boolean
  clearPendingPending: boolean
  clearFailedPending: boolean
  onRetryAll: () => void
  onClearPending: () => void
  onClearFailed: () => void
}

export function CaptureBatchSection({
  t,
  externalJson,
  onExternalJsonChange,
  onRunBatchImport,
  ingestPending,
  ingestPendingCount,
  ingestError,
  ingestMutationError,
  ingestResultCreated,
  pendingJobsTotal,
  processingJobsTotal,
  failedJobsTotal,
  doneJobsTotal,
  recentJobs,
  retryAllPending,
  clearPendingPending,
  clearFailedPending,
  onRetryAll,
  onClearPending,
  onClearFailed
}: CaptureBatchSectionProps) {
  const retriableJobsTotal = pendingJobsTotal + failedJobsTotal

  return (
    <section className="relative mb-8 overflow-hidden border-[3px] border-foreground bg-card p-4 shadow-brutal-sm md:border-4 md:p-5">
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 bg-accent opacity-15" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      <div className="relative z-10 mb-4 flex items-center justify-between gap-2 border-b-4 border-foreground pb-4">
        <p className="font-mono text-xs font-bold uppercase">{t("capture.ingestTitle", "READWISE STYLE BATCH IMPORT")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/api/capture/ingest"
            className="min-h-[44px] flex items-center justify-center border-4 border-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            target="_blank"
          >
            API
          </Link>
          <Link
            href="/api/capture/guide"
            className="min-h-[44px] flex items-center justify-center border-4 border-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            target="_blank"
          >
            {t("capture.guide", "GUIDE")}
          </Link>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-brutal-sm">
          {t("capture.pipelinePending", "Pending")}: {pendingJobsTotal}
        </span>
        <span className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-brutal-sm">
          {t("capture.pipelineProcessing", "Processing")}: {processingJobsTotal}
        </span>
        <span className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-brutal-sm">
          {t("capture.pipelineFailed", "Failed")}: {failedJobsTotal}
        </span>
        <span className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-brutal-sm">
          {t("capture.pipelineDone", "Done")}: {doneJobsTotal}
        </span>
      </div>
      <label htmlFor="capture-batch-json" className="sr-only">
        {t("capture.ingestTitle", "READWISE STYLE BATCH IMPORT")}
      </label>
      <textarea
        id="capture-batch-json"
        rows={6}
        value={externalJson}
        onChange={(event) => onExternalJsonChange(event.target.value)}
        placeholder={t(
          "capture.ingestPlaceholder",
          '[{"content":"...","title":"...","url":"https://...","tags":["book","idea"]}]'
        )}
        className="w-full bg-background border-4 border-foreground text-foreground p-3 font-mono text-xs focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 rounded-none resize-y"
      />
      <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="font-mono text-[10px] font-bold text-muted-foreground">
          {t("capture.ingestHint", "Paste JSON array, Readwise-like highlights, or object with highlights/items.")}
        </p>
        <button
          type="button"
          onClick={onRunBatchImport}
          disabled={!externalJson.trim() || ingestPending}
          className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 w-full sm:w-auto"
        >
          {ingestPending ? t("capture.ingesting", "IMPORTING...") : t("capture.ingestRun", "BATCH IMPORT")}
        </button>
      </div>
      {ingestPending && ingestPendingCount !== null ? (
        <p className="mt-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
          {t("capture.ingestProgress", "PROCESSING ITEMS")}: {ingestPendingCount}
        </p>
      ) : null}
      <details className="mt-3 border-2 border-foreground bg-background p-3 shadow-brutal-sm">
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
            className="min-h-[44px] mb-4 inline-flex items-center justify-center border-4 border-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1"
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
            {t("capture.retryTitle", "INGEST PIPELINE STATUS")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRetryAll}
              disabled={retriableJobsTotal === 0 || retryAllPending}
              className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-foreground px-4 py-2 font-mono text-[10px] font-bold uppercase text-background disabled:opacity-60 transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-background hover:text-foreground"
            >
              {t("capture.retryRun", "RETRY ALL RETRIABLE")}
            </button>
            <button
              type="button"
              onClick={onClearPending}
              disabled={pendingJobsTotal === 0 || clearPendingPending}
              className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-[10px] font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
              {t("capture.retryClearPending", "CLEAR PENDING")}
            </button>
            <button
              type="button"
              onClick={onClearFailed}
              disabled={failedJobsTotal === 0 || clearFailedPending}
              className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-[10px] font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
              {t("capture.retryClearFailed", "CLEAR FAILED")}
            </button>
          </div>
          {recentJobs.length > 0 ? (
            <div className="mt-3 space-y-2 border-t-2 border-foreground pt-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="border-2 border-foreground bg-background p-2">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold uppercase">
                    <span className="border border-foreground px-2 py-1">{job.status}</span>
                    <span>{job.import_channel}</span>
                    <span>{t("capture.pipelineItems", "Items")}: {job.item_count}</span>
                    <span>{t("capture.pipelineAttempts", "Attempts")}: {job.attempts}</span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    {job.preview ?? t("capture.pipelineNoPreview", "No preview available")}
                  </p>
                  {job.last_error ? <p className="mt-2 font-mono text-[10px] text-destructive">{job.last_error}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">
              {t("capture.pipelineEmpty", "No recent pipeline jobs.")}
            </p>
          )}
        </div>
      </details>
      {ingestError ? <p className="mt-2 font-mono text-xs font-bold uppercase text-destructive">{ingestError}</p> : null}
      {ingestMutationError ? <p className="mt-2 font-mono text-xs font-bold uppercase text-destructive">{ingestMutationError}</p> : null}
      {ingestResultCreated !== null ? (
        <p className="mt-2 font-mono text-xs font-bold uppercase text-foreground">
          {t("capture.ingestDone", "Imported")}: {ingestResultCreated}
        </p>
      ) : null}
    </section>
  )
}
