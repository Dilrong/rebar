import { useState } from "react"
import { ChevronDown } from "lucide-react"

type ImportMode = "manual" | "url" | "batch" | "csv" | "ocr"

type CaptureImportModeTabsProps = {
  importMode: ImportMode
  setImportMode: (mode: ImportMode) => void
  t: (key: string, fallback?: string) => string
}

const PRIMARY_MODES: ImportMode[] = ["manual", "url"]
const ADVANCED_MODES: ImportMode[] = ["batch", "csv", "ocr"]

const MODE_LABELS: Record<ImportMode, { key: string; fallback: string }> = {
  manual: { key: "capture.modeManual", fallback: "MANUAL" },
  url: { key: "capture.modeUrl", fallback: "URL" },
  batch: { key: "capture.modeBatch", fallback: "BATCH" },
  csv: { key: "capture.modeCsv", fallback: "CSV" },
  ocr: { key: "capture.modeOcr", fallback: "OCR" }
}

const MODE_DESCRIPTIONS: Record<ImportMode, { key: string; fallback: string }> = {
  manual: { key: "capture.modeManualDesc", fallback: "직접 입력으로 1건 저장" },
  url: { key: "capture.modeUrlDesc", fallback: "URL에서 메타데이터를 읽어 빠르게 캡처" },
  batch: { key: "capture.modeBatchDesc", fallback: "JSON 묶음 인입으로 여러 건 저장" },
  csv: { key: "capture.modeCsvDesc", fallback: "CSV 파일에서 일괄 가져오기" },
  ocr: { key: "capture.modeOcrDesc", fallback: "이미지에서 텍스트 추출 후 저장" }
}

const MODE_CARD_DESCRIPTIONS: Record<ImportMode, { key: string; fallback: string }> = {
  manual: { key: "capture.modeManualCardDesc", fallback: "SINGLE ENTRY" },
  url: { key: "capture.modeUrlCardDesc", fallback: "FETCH META" },
  batch: { key: "capture.modeBatchCardDesc", fallback: "JSON PIPELINE" },
  csv: { key: "capture.modeCsvCardDesc", fallback: "FILE INGEST" },
  ocr: { key: "capture.modeOcrCardDesc", fallback: "TEXT EXTRACT" }
}

function TabButton({ mode, importMode, setImportMode, t, hasBorderRight = true }: {
  mode: ImportMode
  importMode: ImportMode
  setImportMode: (mode: ImportMode) => void
  t: (key: string, fallback?: string) => string
  hasBorderRight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => setImportMode(mode)}
      aria-label={t(MODE_LABELS[mode].key, MODE_LABELS[mode].fallback)}
      className={`flex min-h-[88px] w-[11rem] flex-none flex-col items-start justify-between px-4 py-3 text-left font-mono transition-all duration-200 hover:bg-foreground hover:text-background ${hasBorderRight ? "border-r-4 border-foreground" : ""} ${importMode === mode ? "bg-foreground text-background" : "text-foreground"}`}
    >
      <span className="text-xs font-black uppercase">{t(MODE_LABELS[mode].key, MODE_LABELS[mode].fallback)}</span>
      <span aria-hidden="true" className="text-[10px] font-bold uppercase leading-relaxed text-current/70">
        {t(MODE_CARD_DESCRIPTIONS[mode].key, MODE_CARD_DESCRIPTIONS[mode].fallback)}
      </span>
    </button>
  )
}

export function CaptureImportModeTabs({ importMode, setImportMode, t }: CaptureImportModeTabsProps) {
  const isAdvancedMode = ADVANCED_MODES.includes(importMode)
  const [showMore, setShowMore] = useState(isAdvancedMode)

  return (
    <section className="mb-6 border-b-4 border-foreground pb-0">
      <div className="mb-2 flex overflow-x-auto overflow-y-hidden flex-nowrap border-4 border-foreground bg-background hide-scrollbar shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
        {PRIMARY_MODES.map((mode) => (
          <TabButton key={mode} mode={mode} importMode={importMode} setImportMode={setImportMode} t={t} />
        ))}
        {showMore ? (
          ADVANCED_MODES.map((mode, index) => (
            <TabButton key={mode} mode={mode} importMode={importMode} setImportMode={setImportMode} t={t} hasBorderRight={index < ADVANCED_MODES.length - 1} />
          ))
        ) : (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex min-h-[88px] w-[9rem] flex-none flex-col items-start justify-between gap-2 px-4 py-3 text-left font-mono text-[10px] font-bold uppercase text-muted-foreground transition-all duration-200 hover:bg-foreground hover:text-background"
          >
            <span>{t("capture.moreImport", "MORE")}</span>
            <span className="flex items-center gap-1">
              {t("capture.moreImportDesc", "OPEN ADVANCED MODES")}
              <ChevronDown className="h-3 w-3" strokeWidth={3} />
            </span>
          </button>
        )}
      </div>
      <p className="mb-4 border-l-4 border-accent pl-3 font-mono text-[10px] font-bold uppercase text-muted-foreground">
        {t(MODE_DESCRIPTIONS[importMode].key, MODE_DESCRIPTIONS[importMode].fallback)}
      </p>
    </section>
  )
}
