import type { ChangeEvent } from "react"

type CaptureOcrSectionProps = {
  t: (key: string, fallback?: string) => string
  ocrFileName: string | null
  hasOcrFile: boolean
  ocrPending: boolean
  ocrError: string | null
  ingestError: string | null
  onOcrFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
}

export function CaptureOcrSection({
  t,
  ocrFileName,
  hasOcrFile,
  ocrPending,
  ocrError,
  ingestError,
  onOcrFileChange,
  onSubmit
}: CaptureOcrSectionProps) {
  return (
    <section className="mb-8 border-2 border-foreground p-4 bg-background/60">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase">{t("capture.ocrTitle", "IMAGE OCR")}</p>
      </div>
      <label htmlFor="capture-ocr-file" className="mb-2 block font-mono text-xs font-bold uppercase text-foreground">
        {t("capture.ocrFile", "IMAGE FILE")}
      </label>
      <input
        id="capture-ocr-file"
        type="file"
        accept="image/*"
        onChange={onOcrFileChange}
        className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 font-mono text-xs rounded-none shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-0 cursor-pointer"
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
          onClick={onSubmit}
          disabled={!hasOcrFile || ocrPending}
          className="min-h-[44px] w-full sm:w-auto flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm"
        >
          {ocrPending ? t("capture.ocrRunning", "READING...") : t("capture.ocrRun", "EXTRACT TEXT")}
        </button>
      </div>
      {ocrError ? <p className="mt-2 font-mono text-xs text-destructive">{ocrError}</p> : null}
      {ingestError ? <p className="mt-2 font-mono text-xs text-destructive">{ingestError}</p> : null}
    </section>
  )
}
