type ImportMode = "manual" | "url" | "batch" | "csv" | "ocr"

type CaptureImportModeTabsProps = {
  importMode: ImportMode
  setImportMode: (mode: ImportMode) => void
  t: (key: string, fallback?: string) => string
}

const MODE_DESCRIPTIONS: Record<ImportMode, { key: string; fallback: string }> = {
  manual: { key: "capture.modeManualDesc", fallback: "직접 입력으로 1건 저장" },
  url: { key: "capture.modeUrlDesc", fallback: "URL에서 메타데이터를 읽어 빠르게 캡처" },
  batch: { key: "capture.modeBatchDesc", fallback: "JSON 묶음 인입으로 여러 건 저장" },
  csv: { key: "capture.modeCsvDesc", fallback: "CSV 파일에서 일괄 가져오기" },
  ocr: { key: "capture.modeOcrDesc", fallback: "이미지에서 텍스트 추출 후 저장" }
}

export function CaptureImportModeTabs({ importMode, setImportMode, t }: CaptureImportModeTabsProps) {
  return (
    <section className="mb-6 border-b-4 border-foreground pb-0">
      <div className="flex overflow-x-auto overflow-y-hidden flex-nowrap border-4 border-foreground bg-background hide-scrollbar shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] mb-2">
        <button
          type="button"
          onClick={() => setImportMode("manual")}
          className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-all duration-200 hover:bg-foreground hover:text-background border-r-4 border-foreground ${importMode === "manual" ? "bg-foreground text-background" : "text-foreground"}`}
        >
          {t("capture.modeManual", "MANUAL")}
        </button>
        <button
          type="button"
          onClick={() => setImportMode("url")}
          className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-all duration-200 hover:bg-foreground hover:text-background border-r-4 border-foreground ${importMode === "url" ? "bg-foreground text-background" : "text-foreground"}`}
        >
          {t("capture.modeUrl", "URL")}
        </button>
        <button
          type="button"
          onClick={() => setImportMode("batch")}
          className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-all duration-200 hover:bg-foreground hover:text-background border-r-4 border-foreground ${importMode === "batch" ? "bg-foreground text-background" : "text-foreground"}`}
        >
          {t("capture.modeBatch", "BATCH")}
        </button>
        <button
          type="button"
          onClick={() => setImportMode("csv")}
          className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-all duration-200 hover:bg-foreground hover:text-background border-r-4 border-foreground ${importMode === "csv" ? "bg-foreground text-background" : "text-foreground"}`}
        >
          {t("capture.modeCsv", "CSV")}
        </button>
        <button
          type="button"
          onClick={() => setImportMode("ocr")}
          className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-all duration-200 hover:bg-foreground hover:text-background ${importMode === "ocr" ? "bg-foreground text-background" : "text-foreground"}`}
        >
          {t("capture.modeOcr", "OCR")}
        </button>
      </div>
      <p className="mb-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">
        {t(MODE_DESCRIPTIONS[importMode].key, MODE_DESCRIPTIONS[importMode].fallback)}
      </p>
    </section>
  )
}
