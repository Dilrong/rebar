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
      className={`min-h-[44px] flex-none px-4 py-2 text-center font-mono text-xs font-bold uppercase transition-all duration-200 hover:bg-foreground hover:text-background ${hasBorderRight ? "border-r-4 border-foreground" : ""} ${importMode === mode ? "bg-foreground text-background" : "text-foreground"}`}
    >
      {t(MODE_LABELS[mode].key, MODE_LABELS[mode].fallback)}
    </button>
  )
}

export function CaptureImportModeTabs({ importMode, setImportMode, t }: CaptureImportModeTabsProps) {
  const isAdvancedMode = ADVANCED_MODES.includes(importMode)
  const [showMore, setShowMore] = useState(isAdvancedMode)

  return (
    <section className="mb-6 border-b-4 border-foreground pb-0">
      <div className="flex overflow-x-auto overflow-y-hidden flex-nowrap border-4 border-foreground bg-background hide-scrollbar shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] mb-2">
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
            className="min-h-[44px] flex-none flex items-center gap-1 px-4 py-2 text-center font-mono text-[10px] font-bold uppercase text-muted-foreground transition-all duration-200 hover:bg-foreground hover:text-background"
          >
            {t("capture.moreImport", "MORE")}
            <ChevronDown className="h-3 w-3" strokeWidth={3} />
          </button>
        )}
      </div>
      <p className="mb-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">
        {t(MODE_DESCRIPTIONS[importMode].key, MODE_DESCRIPTIONS[importMode].fallback)}
      </p>
    </section>
  )
}
