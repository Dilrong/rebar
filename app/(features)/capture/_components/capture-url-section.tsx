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
    <section className="relative mb-8 overflow-hidden border-[3px] border-foreground bg-card p-4 shadow-brutal-sm md:border-4 md:p-5">
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 bg-accent opacity-15" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3 border-b-4 border-foreground pb-4">
        <p className="font-mono text-xs font-bold uppercase">{t("capture.quickImport", "QUICK IMPORT FROM URL")}</p>
        <span className="border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-brutal-sm">URL META</span>
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <label htmlFor="capture-url-import" className="sr-only">
          URL import
        </label>
        <input
          id="capture-url-import"
          value={externalUrl}
          onChange={(event) => onExternalUrlChange(event.target.value)}
          placeholder="https://..."
          className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground px-4 py-3 font-mono text-sm focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 placeholder:text-muted-foreground/50 rounded-none"
        />
        <button
          type="button"
          onClick={onImport}
          disabled={!externalUrl || importPending}
          className="flex min-h-[44px] w-full items-center justify-center border-4 border-foreground bg-background px-4 py-3 font-mono text-xs font-bold uppercase text-foreground shadow-brutal-sm transition-all duration-200 active:translate-y-1 active:translate-x-1 hover:translate-x-1 hover:translate-y-1 hover:shadow-none hover:bg-foreground hover:text-background md:min-w-[100px] md:w-auto"
        >
          {importPending ? <LoadingDots /> : t("capture.import", "IMPORT")}
        </button>
      </div>
      {importError ? <p className="mt-2 font-mono text-xs font-bold uppercase text-destructive">{importError}</p> : null}
      {importSuccess ? (
        <p className="mt-2 font-mono text-xs font-bold uppercase text-foreground">
          {t("capture.importSuccess", "URL metadata loaded into the form.")}
        </p>
      ) : null}
    </section>
  )
}
