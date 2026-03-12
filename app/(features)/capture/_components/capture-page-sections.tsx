import type { ReactNode } from "react"

type CapturePageSectionsProps = {
  t: (key: string, fallback?: string) => string
  children: ReactNode
}

export function CapturePageSections({ t, children }: CapturePageSectionsProps) {
  return (
    <div className="relative overflow-hidden border-[3px] border-foreground bg-card p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] md:border-4 md:p-10 md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 bg-accent opacity-20 md:h-28 md:w-28" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      <header className="relative z-10 mb-6 flex flex-col justify-between gap-4 border-b-[3px] border-foreground pb-4 md:mb-10 md:flex-row md:items-end md:border-b-4 md:pb-6">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground md:text-xs">01 / INGEST SURFACE</p>
          <h1 className="mt-3 font-black text-3xl uppercase leading-none text-foreground md:text-5xl">{t("capture.title", "CAPTURE")}</h1>
          <p className="mt-4 max-w-none border-l-4 border-accent pl-4 font-sans text-sm font-bold leading-relaxed text-foreground/80 md:text-base">
            {t("capture.subtitle", "Move from raw input to structured records with manual entry, URL extraction, batch ingest, CSV import, and OCR.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <span className="w-fit bg-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase text-background md:text-xs">
            {t("capture.ready", "READY TO ADD")}
          </span>
          <span className="w-fit border-2 border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-brutal-sm md:text-xs">
            <span className="sm:hidden">OCR / JSON / CSV</span>
            <span className="hidden sm:inline">LOCAL OCR / JSON / CSV</span>
          </span>
        </div>
      </header>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
