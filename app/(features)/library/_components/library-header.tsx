import Link from "next/link"
import { Database, Plus } from "lucide-react"
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, RefObject } from "react"
import type { ExportFormat } from "@feature-lib/export/formats"
import { LibraryExportMenu } from "./library-export-menu"

type LibraryHeaderProps = {
  t: (key: string, fallback?: string) => string
  totalRows: number
  exportSince: string
  exportScopeLabel: string
  exportSincePresets: Array<{
    key: string
    fallback: string
    value: string
  }>
  exportMenuOpen: boolean
  exportPending: boolean
  exportMenuWrapRef: RefObject<HTMLDivElement | null>
  exportTriggerRef: RefObject<HTMLButtonElement | null>
  exportItemRefs: MutableRefObject<Array<HTMLButtonElement | null>>
  onExportSinceChange: (value: string) => void
  onClearExportSince: () => void
  onToggleMenu: () => void
  onOpenMenuFromKeyboard: () => void
  onCloseMenu: () => void
  onExport: (format: ExportFormat) => void
  onMenuItemKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}

export function LibraryHeader({
  t,
  totalRows,
  exportSince,
  exportScopeLabel,
  exportSincePresets,
  exportMenuOpen,
  exportPending,
  exportMenuWrapRef,
  exportTriggerRef,
  exportItemRefs,
  onExportSinceChange,
  onClearExportSince,
  onToggleMenu,
  onOpenMenuFromKeyboard,
  onCloseMenu,
  onExport,
  onMenuItemKeyDown
}: LibraryHeaderProps) {
  return (
    <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between border-[3px] md:border-4 border-foreground pb-4 p-4 md:p-6 bg-noise relative overflow-hidden shadow-brutal-sm md:shadow-brutal gap-4 md:gap-6 bg-card transition-all duration-300">
      <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-accent opacity-20 pointer-events-none" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      <h1 className="relative z-10 flex items-start gap-3 text-3xl font-black uppercase leading-none text-foreground transition-transform hover:translate-x-1 cursor-default sm:items-center sm:text-4xl md:text-5xl">
        <Database className="w-8 h-8 md:w-10 md:h-10 text-accent" strokeWidth={3} />
        <span className="text-glitch transition-all">{t("library.title", "LIBRARY")}</span>
      </h1>
      <div className="relative z-10 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center md:gap-3">
        <span className="min-h-[48px] flex w-full flex-col justify-center border-[3px] md:border-4 border-foreground bg-background px-3 py-1 font-mono text-xs font-bold uppercase text-foreground shadow-brutal-sm sm:w-auto sm:flex-row sm:items-center md:text-sm">
          <span className="opacity-80 text-[10px] md:mr-2 tracking-widest">{t("library.rows", "ROWS")}:</span>
          <span className="font-black text-lg leading-none">{totalRows}</span>
        </span>
        <label htmlFor="library-export-since" className="flex w-full min-w-0 flex-col sm:w-auto">
          <span className="mb-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("library.exportSince", "INCREMENTAL SINCE")}
          </span>
          <input
            id="library-export-since"
            type="date"
            value={exportSince}
            onChange={(event) => onExportSinceChange(event.target.value)}
            className="min-h-[48px] w-full border-[3px] border-foreground bg-background px-3 py-2 font-mono text-xs font-bold text-foreground shadow-brutal-sm focus:outline-none focus:ring-0 md:border-4"
          />
          <span className="mt-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("library.exportSinceHint", "LEAVE BLANK FOR FULL EXPORT")}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {exportSincePresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => onExportSinceChange(preset.value)}
                className={`min-h-[44px] border-[3px] border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-brutal-sm transition-transform active:translate-x-[1px] active:translate-y-[1px] ${exportSince === preset.value ? "bg-foreground text-background" : "bg-background text-foreground hover:bg-foreground hover:text-background"
                  }`}
                aria-pressed={exportSince === preset.value}
              >
                {t(preset.key, preset.fallback)}
              </button>
            ))}
            {exportSince ? (
              <button
                type="button"
                onClick={onClearExportSince}
                className="min-h-[44px] border-[3px] border-foreground bg-background px-2 py-1 font-mono text-[10px] font-bold uppercase text-foreground shadow-brutal-sm transition-transform hover:bg-foreground hover:text-background active:translate-x-[1px] active:translate-y-[1px]"
              >
                {t("library.exportClearSince", "CLEAR")}
              </button>
            ) : null}
          </div>
          <span className="mt-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("library.exportScope", "CURRENT SCOPE")}: {exportScopeLabel}
          </span>
        </label>
        <LibraryExportMenu
          t={t}
          exportMenuOpen={exportMenuOpen}
          exportPending={exportPending}
          exportMenuWrapRef={exportMenuWrapRef}
          exportTriggerRef={exportTriggerRef}
          exportItemRefs={exportItemRefs}
          onExport={onExport}
          onToggleMenu={onToggleMenu}
          onOpenMenuFromKeyboard={onOpenMenuFromKeyboard}
          onCloseMenu={onCloseMenu}
          onMenuItemKeyDown={onMenuItemKeyDown}
        />
        <Link
          href="/capture"
          className="max-md:hidden btn-cta"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("library.newRecord", "NEW RECORD")}
        </Link>
      </div>
    </header>
  )
}
