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
        className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 font-mono text-xs rounded-none shadow-brutal-sm focus:outline-none focus:ring-0 cursor-pointer focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:border-4 file:border-foreground file:text-xs file:font-bold file:uppercase file:bg-foreground file:text-background hover:file:bg-background hover:file:text-foreground file:transition-all file:duration-200 file:cursor-pointer"
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
          className="min-h-[44px] w-full sm:w-auto flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-60 hover:bg-foreground hover:text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1"
        >
          {ocrPending ? t("capture.ocrRunning", "READING...") : t("capture.ocrRun", "EXTRACT TEXT")}
        </button>
      </div>
      {ocrError ? <p className="mt-2 font-mono text-xs text-destructive">{ocrError}</p> : null}
      {ingestError ? <p className="mt-2 font-mono text-xs text-destructive">{ingestError}</p> : null}
    </section>
  )
}
