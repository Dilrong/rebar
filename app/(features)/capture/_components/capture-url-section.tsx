import { LoadingDots } from "@shared/ui/loading"

type CaptureUrlSectionProps = {
  t: (key: string, fallback?: string) => string
  externalUrl: string
  onExternalUrlChange: (value: string) => void
  onImport: () => void
  importPending: boolean
  importError: string | null
  importSuccess: boolean
}

export function CaptureUrlSection({
  t,
  externalUrl,
  onExternalUrlChange,
  onImport,
  importPending,
  importError,
  importSuccess
}: CaptureUrlSectionProps) {
  return (
    <section className="mb-8 border-2 border-foreground p-4 bg-background/60">
      <p className="font-mono text-xs font-bold uppercase mb-3">{t("capture.quickImport", "QUICK IMPORT FROM URL")}</p>
      <div className="flex flex-col md:flex-row gap-3">
        <label htmlFor="capture-url-import" className="sr-only">
          URL import
        </label>
        <input
          id="capture-url-import"
          value={externalUrl}
          onChange={(event) => onExternalUrlChange(event.target.value)}
          placeholder="https://..."
          className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground px-4 py-3 font-mono text-sm focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] placeholder:text-muted-foreground/50 rounded-none transition-none"
        />
        <button
          type="button"
          onClick={onImport}
          disabled={!externalUrl || importPending}
          className="min-h-[44px] px-4 py-3 border-4 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground min-w-[100px] flex items-center justify-center hover:bg-foreground hover:text-background transition-all active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm"
        >
          {importPending ? <LoadingDots /> : t("capture.import", "IMPORT")}
        </button>
      </div>
      {importError ? <p className="font-mono text-xs text-destructive mt-2">{importError}</p> : null}
      {importSuccess ? (
        <p className="font-mono text-xs text-foreground mt-2">
          {t("capture.importSuccess", "URL metadata loaded into the form.")}
        </p>
      ) : null}
    </section>
  )
}
